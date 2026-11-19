/* ============================================================================
   MORSE HAND · Trí tuệ nhân tạo chạy hoàn toàn trong trình duyệt
   ----------------------------------------------------------------------------
   PHẦN 0.  Bảng mã Morse & tham chiếu DOM
   PHẦN 1.  k-NN (k-Nearest Neighbors) — phân loại cử chỉ tay 42 chiều
   PHẦN 2.  A* Search — gợi ý / tự sửa lỗi mã Morse trên cây nhị phân
   PHẦN 3.  Bộ đệm Morse, giao diện, cooldown
   PHẦN 4.  MediaPipe Hands + camera (tối ưu canvas & độ phân giải)
   ========================================================================== */

/* ============================================================================
   PHẦN 0 · BẢNG MÃ MORSE
   Mỗi khoá là một chuỗi tín hiệu ('.' = chấm, '-' = gạch), giá trị là ký tự.
   Bảng này chính là "từ điển" mà cây nhị phân Morse ở PHẦN 2 biểu diễn.
   ========================================================================== */
const MORSE = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
  '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
  '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
  '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
  '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
  '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
  '---..': '8', '----.': '9'
};

/* --- Tham chiếu DOM ------------------------------------------------------- */
const video = document.querySelector('#inputVideo');
const canvas = document.querySelector('#outputCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.querySelector('#startButton');
const badge = document.querySelector('#gestureBadge');
const statusEl = document.querySelector('#cameraStatus');
const modeBadge = document.querySelector('#modeBadge');
const morseEl = document.querySelector('#morseInput');
const textEl = document.querySelector('#decodedText');
const hint = document.querySelector('#lastSignal');
const suggestionsEl = document.querySelector('#suggestions');
const trainerModeEl = document.querySelector('#trainerMode');
const trainerStatusEl = document.querySelector('#trainerStatus');
const countEls = {
  dot: document.querySelector('#countDot'),
  dash: document.querySelector('#countDash'),
  neutral: document.querySelector('#countNeutral')
};

/* --- Trạng thái toàn cục -------------------------------------------------- */
let code = '';              // chuỗi Morse đang nhập dở (ví dụ ".-.")
let text = '';              // văn bản đã dịch
let lastGesture = '';       // cử chỉ của khung hình trước (chống lặp)
let lastAccepted = 0;       // thời điểm chấp nhận tín hiệu gần nhất (ms)
let currentLandmarks = null; // 21 landmark của khung hình mới nhất

const COOLDOWN_MS = 800;         // thời gian chờ tối thiểu giữa 2 tín hiệu
const CANVAS_W = 640;            // độ phân giải xử lý mong muốn
const CANVAS_H = 480;

/* ============================================================================
   PHẦN 1 · k-NN — PHÂN LOẠI CỬ CHỈ BÀN TAY
   ----------------------------------------------------------------------------
   Bài toán: cho 21 điểm mốc (x, y) của bàn tay do MediaPipe trả về, dự đoán
   một trong 3 nhãn: 'dot' (nắm tay), 'dash' (mở 5 ngón), 'neutral' (chờ).

   k-NN không học tham số: nó "học" bằng cách ghi nhớ toàn bộ mẫu huấn luyện
   (lazy learning). Khi có mẫu mới, ta tìm k mẫu gần nhất theo khoảng cách
   Euclidean rồi bỏ phiếu. Muốn k-NN hoạt động tốt, dữ liệu phải được chuẩn
   hoá để hai người ở hai khoảng cách camera khác nhau vẫn cho vector giống
   nhau — đó là nhiệm vụ của extractFeatureVector().
   ========================================================================== */

const K_NEIGHBORS = 5;      // số láng giềng k
const EPSILON = 1e-6;       // epsilon chống chia cho 0 trong trọng số 1/(d+ε)
const LABELS = ['dot', 'dash', 'neutral'];
const STORAGE_KEY = 'morseHand.knnSamples.v1';
const MAX_PER_LABEL = 120;  // giới hạn mẫu mỗi nhãn để localStorage không phình

/**
 * Trích xuất vector đặc trưng 42 chiều từ 21 landmark.
 *
 * Công thức (bất biến với vị trí và khoảng cách camera):
 *   1) Tịnh tiến:  p_i' = p_i - p_0            (gốc toạ độ = cổ tay lm[0])
 *   2) Tỷ lệ:      d_max = max_i ||p_i'||
 *                  v_i   = p_i' / d_max
 *   3) Ghép:       v = [x_0, y_0, x_1, y_1, ..., x_20, y_20]  ∈ R^42
 *
 * Nhờ bước 1 và 2, vector chỉ còn mã hoá *hình dạng* bàn tay: tay to/nhỏ,
 * gần/xa camera, lệch trái/phải khung hình đều cho cùng một vector.
 * Mỗi toạ độ nằm trong đoạn [-1, 1].
 *
 * @param {Array<{x:number,y:number}>} landmarks 21 điểm mốc MediaPipe
 * @returns {number[]|null} vector 42 chiều (null nếu dữ liệu không hợp lệ)
 */
function extractFeatureVector(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;

  // --- Bước 1: tịnh tiến, lấy cổ tay làm gốc (0, 0) -----------------------
  const ox = landmarks[0].x;
  const oy = landmarks[0].y;
  const shifted = [];
  for (let i = 0; i < 21; i++) {
    shifted.push([landmarks[i].x - ox, landmarks[i].y - oy]);
  }

  // --- Bước 2: tìm d_max = khoảng cách lớn nhất từ cổ tay tới các khớp -----
  let dMax = 0;
  for (const [x, y] of shifted) {
    const d = Math.hypot(x, y);   // ||p_i'|| = sqrt(x² + y²)
    if (d > dMax) dMax = d;
  }
  if (dMax < 1e-6) return null;   // 21 điểm trùng nhau → không có hình dạng

  // --- Bước 3: chia tỷ lệ để đưa mọi toạ độ về [-1, 1] ---------------------
  const vector = new Array(42);
  for (let i = 0; i < 21; i++) {
    vector[i * 2] = shifted[i][0] / dMax;
    vector[i * 2 + 1] = shifted[i][1] / dMax;
  }
  return vector;
}

/**
 * Khoảng cách Euclidean trong không gian R^42:
 *   d(a, b) = sqrt( Σ_{j=1}^{42} (a_j - b_j)² )
 */
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let j = 0; j < a.length; j++) {
    const diff = a[j] - b[j];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/* --- Bộ dữ liệu mẫu (lưu bền trong localStorage) ------------------------- */

/** Đọc bộ dữ liệu mẫu từ localStorage. */
function loadSamples() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Lọc dữ liệu hỏng / phiên bản cũ
    return parsed.filter(
      (s) => s && LABELS.includes(s.label) && Array.isArray(s.v) && s.v.length === 42
    );
  } catch (e) {
    console.warn('Không đọc được mẫu k-NN:', e);
    return [];
  }
}

/** Ghi bộ dữ liệu mẫu xuống localStorage. */
function saveSamples(samples) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch (e) {
    console.warn('Không lưu được mẫu k-NN:', e);
  }
}

/** Đếm số mẫu theo từng nhãn. */
function sampleCounts(samples) {
  const counts = { dot: 0, dash: 0, neutral: 0 };
  for (const s of samples) if (counts[s.label] !== undefined) counts[s.label]++;
  return counts;
}

/** Chế độ hiện tại: 'knn' khi đã có ≥ k mẫu, ngược lại 'heuristic'. */
function currentMode(samples = loadSamples()) {
  return samples.length >= K_NEIGHBORS ? 'knn' : 'heuristic';
}

/**
 * Thu thập 1 mẫu huấn luyện từ khung hình hiện tại.
 * Mẫu được lưu dạng { label, v: number[42] } (làm tròn 3 chữ số thập phân
 * để giảm dung lượng localStorage).
 */
function addSample(label) {
  if (!currentLandmarks) {
    trainerStatusEl.textContent = '⚠️ Chưa thấy bàn tay — hãy đưa tay vào khung hình.';
    return;
  }
  const vector = extractFeatureVector(currentLandmarks);
  if (!vector) {
    trainerStatusEl.textContent = '⚠️ Không trích xuất được đặc trưng, thử lại.';
    return;
  }

  const samples = loadSamples();
  if (samples.filter((s) => s.label === label).length >= MAX_PER_LABEL) {
    trainerStatusEl.textContent = `Đã đạt giới hạn ${MAX_PER_LABEL} mẫu cho nhãn "${label}".`;
    return;
  }

  samples.push({ label, v: vector.map((n) => Math.round(n * 1000) / 1000) });
  saveSamples(samples);
  renderTrainer();

  const mode = currentMode(samples);
  trainerStatusEl.textContent = mode === 'knn'
    ? `Đã lưu mẫu "${label}". Tổng ${samples.length} mẫu → k-NN (k=${K_NEIGHBORS}) đang hoạt động.`
    : `Đã lưu mẫu "${label}". Tổng ${samples.length} mẫu → cần ≥ ${K_NEIGHBORS} mẫu để bật k-NN.`;
}

/**
 * Heuristic dự phòng (khi bộ mẫu chưa đủ k phần tử).
 *
 * Với mỗi ngón (trỏ, giữa, áp út, út) ta so sánh khoảng cách từ cổ tay tới
 * ĐẦU NGÓN (tip) với khoảng cách từ cổ tay tới KHỚP GIỮA (PIP):
 *
 *        ratio_i = d(cổ tay, tip_i) / d(cổ tay, pip_i)
 *
 * Ngón duỗi thẳng  → đầu ngón xa hơn khớp giữa  → ratio > 1
 * Ngón gập lại     → đầu ngón gần hơn khớp giữa  → ratio < 1
 *
 * Vì chỉ dùng *tỷ lệ khoảng cách* (đại lượng bất biến với phép quay và phép
 * co giãn), heuristic này không phụ thuộc góc nghiêng tay hay vị trí camera.
 *
 * @returns {{label:string, ratio:number}}
 */
function heuristicGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return { label: 'neutral', ratio: 0 };

  const wrist = landmarks[0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // [tip, pip] cho ngón trỏ, giữa, áp út, út (bỏ ngón cái vì khó chuẩn hoá)
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]];
  let extended = 0;
  let ratioSum = 0;

  for (const [tip, pip] of fingers) {
    const dTip = dist(wrist, landmarks[tip]);
    const dPip = dist(wrist, landmarks[pip]) || EPSILON;
    const ratio = dTip / dPip;
    ratioSum += ratio;
    if (ratio > 1.15) extended++;   // ngón đang duỗi
  }

  const ratio = ratioSum / fingers.length;
  if (extended >= 3) return { label: 'dash', ratio };    // ≥3 ngón duỗi → bàn tay mở
  if (extended <= 1) return { label: 'dot', ratio };     // ≤1 ngón duỗi → nắm tay
  return { label: 'neutral', ratio };                    // 2 ngón → trạng thái chờ
}

/**
 * Phân loại cử chỉ bằng k-NN có trọng số nghĩa đảo khoảng cách.
 *
 * Thuật toán:
 *   1. v = extractFeatureVector(landmarks)                    → v ∈ R^42
 *   2. Nếu |dataset| < k  → dùng heuristicGesture() dự phòng
 *   3. d_i = euclideanDistance(v, sample_i)  với mọi mẫu
 *   4. Sắp xếp tăng dần, lấy k mẫu gần nhất (k = 5)
 *   5. Bỏ phiếu có trọng số:  w_i = 1 / (d_i + ε)
 *        score[label] = Σ_{i ∈ k láng giềng, nhãn_i = label} w_i
 *   6. Nhãn thắng = argmax score; độ tin cậy = score / Σ score
 *
 * Ý nghĩa trọng số: mẫu càng gần thì tiếng nói càng lớn. Nếu d_i = 0 (mẫu
 * trùng khít) thì w_i ≈ 1/ε → rất lớn, gần như quyết định kết quả.
 *
 * @returns {{label:string, source:'knn'|'heuristic', confidence:number,
 *            neighbors:Array<{label:string,distance:number}>}}
 */
function classifyWithKNN(landmarks) {
  const samples = loadSamples();
  const vector = extractFeatureVector(landmarks);

  // --- Nhánh dự phòng: chưa đủ dữ liệu (hoặc landmark hỏng) ---------------
  if (!vector || samples.length < K_NEIGHBORS) {
    const h = heuristicGesture(landmarks);
    return {
      label: h.label,
      source: 'heuristic',
      confidence: 0,
      ratio: h.ratio,
      neighbors: []
    };
  }

  // --- Bước 3: tính khoảng cách tới toàn bộ mẫu ---------------------------
  const scored = samples
    .map((s) => ({ label: s.label, distance: euclideanDistance(vector, s.v) }))
    .filter((s) => Number.isFinite(s.distance))
    .sort((a, b) => a.distance - b.distance);

  if (scored.length < K_NEIGHBORS) {
    const h = heuristicGesture(landmarks);
    return { label: h.label, source: 'heuristic', confidence: 0, ratio: h.ratio, neighbors: [] };
  }

  // --- Bước 4: lấy k láng giềng gần nhất ----------------------------------
  const neighbors = scored.slice(0, K_NEIGHBORS);

  // --- Bước 5: bỏ phiếu có trọng số nghịch đảo khoảng cách -----------------
  const votes = { dot: 0, dash: 0, neutral: 0 };
  let total = 0;
  for (const n of neighbors) {
    if (votes[n.label] === undefined) continue;
    const w = 1 / (n.distance + EPSILON);
    votes[n.label] += w;
    total += w;
  }

  // --- Bước 6: chọn nhãn có điểm cao nhất --------------------------------
  let label = 'neutral';
  let best = -Infinity;
  for (const l of LABELS) {
    if (votes[l] > best) { best = votes[l]; label = l; }
  }

  return {
    label,
    source: 'knn',
    confidence: total > 0 ? best / total : 0,
    neighbors
  };
}

/* ============================================================================
   PHẦN 2 · A* SEARCH TRÊN CÂY NHỊ PHÂN MORSE
   ----------------------------------------------------------------------------
   Mô hình hoá không gian trạng thái:
     • Trạng thái = một chuỗi tín hiệu (tiền tố của mã Morse).
     • Trạng thái đầu = "" (gốc cây).
     • Sinh trạng thái kế: nối thêm '.' (nhánh trái) hoặc '-' (nhánh phải).
     • Độ sâu tối đa = 5 (mã Morse dài nhất trong bảng là 5 tín hiệu).
     • Trạng thái đích = một node có trong từ điển MORSE.

   Hàm đánh giá:  f(n) = g(n) + h(n)
     • g(n) = độ sâu của node n = chi phí thực đã đi (mỗi cạnh = 1).
     • h(n) = Levenshtein(n.code, code) — số phép chèn/xoá/thay thế tối thiểu
              để biến chuỗi tại node thành chuỗi người dùng đang nhập.
              Đây là heuristic "khoảng cách tới đích" rất tự nhiên: node nào
              gần mã người dùng nhập hơn thì càng đáng được mở rộng trước.

   Levenshtein (quy hoạch động): D[i][j] = số phép biến đổi tối thiểu để biến
   i ký tự đầu của a thành j ký tự đầu của b:
        D[i][0] = i,  D[0][j] = j
        D[i][j] = min(
            D[i-1][j]   + 1,          // xoá a[i]
            D[i][j-1]   + 1,          // chèn b[j]
            D[i-1][j-1] + (a[i]!=b[j])// thay thế (hoặc giữ nguyên nếu bằng)
        )
   ========================================================================== */

const MAX_DEPTH = 5;   // độ sâu tối đa của cây nhị phân Morse

/**
 * Khoảng cách chỉnh sửa Levenshtein giữa hai chuỗi (quy hoạch động, O(m·n)).
 * @returns {number} số phép chèn/xoá/thay thế tối thiểu
 */
function levenshtein(a, b) {
  a = a || '';
  b = b || '';
  const m = a.length;
  const n = b.length;

  // Hàng trước và hàng hiện tại (tối ưu bộ nhớ O(n) thay vì O(m·n))
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;   // D[0][j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i;                               // D[i][0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,               // xoá
        curr[j - 1] + 1,           // chèn
        prev[j - 1] + cost         // thay thế / giữ nguyên
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

/** Độ dài tiền tố chung của hai chuỗi (dùng để phá hoà khi xếp hạng). */
function commonPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * A* tìm các ký tự Morse gần nhất với chuỗi tín hiệu người dùng.
 *
 * Vì cây chỉ có 2^1 + 2^2 + ... + 2^5 = 62 node, ta duyệt A* tới khi hàng đợi
 * ưu tiên cạn (hoặc chạm trần mở rộng) rồi xếp hạng *toàn bộ* node đích theo
 * h = Levenshtein. Nhờ vậy vừa có "Top 1 để sửa lỗi" vừa có "Top 3 để gợi ý".
 *
 * @param {string} code chuỗi tín hiệu người dùng đang nhập
 * @param {number} limit số kết quả trả về
 * @returns {Array<{char:string, code:string, distance:number, g:number, h:number, f:number}>}
 */
function aStarMorseSearch(code, limit = 3) {
  if (!code) return [];

  // Hàng đợi ưu tiên (open set) — dùng mảng + tìm min, đủ nhanh với 62 node
  const open = [{ node: '', g: 0, h: levenshtein('', code), f: levenshtein('', code) }];
  const found = new Map();   // char -> kết quả tốt nhất (khử trùng lặp ký tự)
  const MAX_EXPANSIONS = 600;
  let expansions = 0;

  while (open.length && expansions < MAX_EXPANSIONS) {
    expansions++;

    // --- Pop node có f nhỏ nhất (hoà nhau thì ưu tiên h nhỏ hơn) ---------
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f ||
         (open[i].f === open[bestIdx].f && open[i].h < open[bestIdx].h)) {
        bestIdx = i;
      }
    }
    const current = open.splice(bestIdx, 1)[0];

    // --- Kiểm tra trạng thái đích: node có trong từ điển? -----------------
    const char = MORSE[current.node];
    if (char) {
      const existing = found.get(char);
      if (!existing || current.h < existing.h) {
        found.set(char, {
          char,
          code: current.node,
          distance: current.h,
          g: current.g,
          h: current.h,
          f: current.f
        });
      }
    }

    // --- Sinh node con nếu chưa chạm độ sâu tối đa ------------------------
    if (current.node.length >= MAX_DEPTH) continue;
    for (const signal of ['.', '-']) {
      const childNode = current.node + signal;
      const g = current.g + 1;                    // chi phí = độ sâu
      const h = levenshtein(childNode, code);     // heuristic Levenshtein
      open.push({ node: childNode, g, h, f: g + h });
    }
  }

  /**
   * Xếp hạng ứng viên:
   *   1) h = khoảng cách Levenshtein nhỏ nhất  → gần mã người dùng nhất
   *   2) f = g + h nhỏ hơn                     → node "rẻ" hơn trên cây
   *   3) tiền tố chung dài hơn với `code`      → giữ được tín hiệu đầu người dùng
   *   4) chênh lệch độ dài nhỏ hơn            → ít thêm/bớt tín hiệu hơn
   *   5) thứ tự chữ cái (đảm bảo kết quả ổn định)
   */
  return [...found.values()]
    .sort((a, b) =>
      a.distance - b.distance ||
      a.f - b.f ||
      commonPrefixLength(b.code, code) - commonPrefixLength(a.code, code) ||
      Math.abs(a.code.length - code.length) - Math.abs(b.code.length - code.length) ||
      a.code.localeCompare(b.code)
    )
    .slice(0, limit);
}

/* ============================================================================
   PHẦN 3 · BỘ ĐỆM MORSE · RENDER · COOLDOWN
   ========================================================================== */

/** Vẽ lại toàn bộ phần văn bản: bản dịch, mã đang nhập, gợi ý A*. */
function render() {
  morseEl.textContent = code || 'Chưa có ký tự';
  textEl.textContent = text || '—';
  renderSuggestions();
  renderModeBadges();
}

/** Hiển thị Top 3 gợi ý từ A* dưới dòng morseInput. */
function renderSuggestions() {
  suggestionsEl.innerHTML = '';

  if (!code) {
    const empty = document.createElement('span');
    empty.className = 'suggest-empty';
    empty.textContent = 'Nhập tín hiệu để gợi ý';
    suggestionsEl.appendChild(empty);
    return;
  }

  const results = aStarMorseSearch(code, 3);
  if (!results.length) {
    const empty = document.createElement('span');
    empty.className = 'suggest-empty';
    empty.textContent = 'Không có gợi ý';
    suggestionsEl.appendChild(empty);
    return;
  }

  results.forEach((item, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'suggest-chip' + (index === 0 ? ' is-best' : '');
    chip.title = `Mã ${item.code} · khoảng cách ${item.distance} · f = ${item.f}`;
    chip.innerHTML =
      `<b>${item.char}</b>` +
      `<span class="chip-code">${item.code}</span>` +
      `<span class="chip-cost">d=${item.distance}</span>`;
    // Bấm chip = chốt ngay ký tự đó (bỏ qua phần đang nhập dở)
    chip.addEventListener('click', () => {
      pushLetter(item.char);
      hint.textContent = `A* → ${item.char} (${item.code})`;
      code = '';
      render();
    });
    suggestionsEl.appendChild(chip);
  });
}

/** Cập nhật nhãn chế độ (k-NN / Heuristic) ở tiêu đề camera & trainer. */
function renderModeBadges() {
  const samples = loadSamples();
  const mode = currentMode(samples);
  const label = mode === 'knn' ? `k-NN · k=${K_NEIGHBORS}` : 'Heuristic';
  modeBadge.textContent = label;
  modeBadge.classList.toggle('is-knn', mode === 'knn');
  trainerModeEl.textContent = mode === 'knn' ? 'k-NN' : 'Heuristic';
  trainerModeEl.classList.toggle('is-knn', mode === 'knn');

  const counts = sampleCounts(samples);
  for (const l of LABELS) countEls[l].textContent = counts[l];
}

/** Nối ký tự vào văn bản đã dịch. */
function pushLetter(char) {
  text += char;
}

/**
 * Chốt ký tự hiện tại.
 * Nếu chuỗi `code` không khớp chính xác từ điển MORSE (dư/thiếu tín hiệu),
 * dùng kết quả Top 1 của A* để tự sửa lỗi thay vì in ra ký tự lỗi.
 */
function commitLetter() {
  if (!code) return;

  let char = MORSE[code];

  if (char) {
    hint.textContent = `→ ${char}`;
  } else {
    const best = aStarMorseSearch(code, 1)[0];
    if (best) {
      char = best.char;
      hint.textContent = `A* sửa lỗi: ${code} → ${best.code} = ${char}`;
    } else {
      char = '\uFFFD'; // không có ứng viên nào
      hint.textContent = 'Mã chưa hợp lệ';
    }
  }

  pushLetter(char);
  code = '';
  render();
}

/** Thêm một tín hiệu '.' hoặc '-' vào bộ đệm. */
function addSignal(signal) {
  code += signal;
  lastAccepted = Date.now();
  hint.textContent = signal === '.' ? 'Đã thêm chấm' : 'Đã thêm gạch';
  render();
}

/**
 * Áp dụng kết quả phân loại: cập nhật badge, kiểm tra cooldown rồi nhập tín hiệu.
 * Luật: chỉ nhận tín hiệu khi cử chỉ ĐỔI so với khung trước và đã qua cooldown.
 */
function applyGesture(result, landmarks) {
  const labels = {
    dot: 'Nắm tay · dấu chấm',
    dash: 'Bàn tay mở · dấu gạch',
    neutral: 'Đổi cử chỉ để tiếp tục'
  };

  let prefix = labels[result.label] || 'Đang chờ tay';
  if (result.source === 'knn') {
    prefix += ` · k-NN ${(result.confidence * 100).toFixed(0)}%`;
  } else {
    prefix += ' · Heuristic';
  }
  badge.textContent = prefix;

  const { label } = result;
  if ((label === 'dot' || label === 'dash') &&
      label !== lastGesture &&
      Date.now() - lastAccepted > COOLDOWN_MS) {
    addSignal(label === 'dot' ? '.' : '-');
  }
  lastGesture = label;
}

/* ============================================================================
   PHẦN 4 · MEDIAPIPE HANDS + CAMERA
   ========================================================================== */

let lastCanvasW = 0;
let lastCanvasH = 0;

/**
 * Callback mỗi khung hình từ MediaPipe.
 * Tối ưu: chỉ cập nhật canvas.width/height khi kích thước video THAY ĐỔI,
 * vì gán lại width/height sẽ reset toàn bộ context và gây tốn CPU/GPU.
 */
function onResults(results) {
  const w = video.videoWidth || CANVAS_W;
  const h = video.videoHeight || CANVAS_H;

  if (w !== lastCanvasW || h !== lastCanvasH) {
    canvas.width = w;
    canvas.height = h;
    lastCanvasW = w;
    lastCanvasH = h;
  }

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  const hands = results.multiHandLandmarks;

  if (hands && hands.length) {
    const lm = hands[0];              // chỉ dùng bàn tay đầu tiên
    currentLandmarks = lm;

    drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#c9f26b', lineWidth: 4 });
    drawLandmarks(ctx, lm, { color: '#ff7446', lineWidth: 2, radius: 3 });

    // Phân loại bằng k-NN (tự rơi về heuristic nếu thiếu mẫu)
    applyGesture(classifyWithKNN(lm), lm);
  } else {
    currentLandmarks = null;
    lastGesture = '';
    badge.textContent = 'Đưa một bàn tay vào khung';
  }

  ctx.restore();
}

const handsModel = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
handsModel.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
handsModel.onResults(onResults);

async function startCamera() {
  try {
    startButton.disabled = true;
    startButton.textContent = 'Đang mở camera…';

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: CANVAS_W },   // 640×480: đủ cho 21 landmark, nhẹ CPU
        height: { ideal: CANVAS_H }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    const camera = new Camera(video, {
      onFrame: async () => { await handsModel.send({ image: video }); },
      width: CANVAS_W,
      height: CANVAS_H
    });
    camera.start();

    document.querySelector('.camera-card').classList.add('active');
    statusEl.textContent = 'Đang nhận diện';
    startButton.textContent = 'Camera đang bật';
  } catch (e) {
    startButton.disabled = false;
    startButton.textContent = 'Thử bật lại camera';
    statusEl.textContent = 'Không thể mở camera';
    badge.textContent = 'Hãy cho phép quyền camera';
  }
}

/* ============================================================================
   PHẦN 5 · GẮN SỰ KIỆN GIAO DIỆN
   ========================================================================== */

startButton.addEventListener('click', startCamera);

document.querySelector('#letterButton').addEventListener('click', commitLetter);
document.querySelector('#spaceButton').addEventListener('click', () => {
  commitLetter();
  text += ' ';
  render();
});
document.querySelector('#backspaceButton').addEventListener('click', () => {
  code = code.slice(0, -1);
  hint.textContent = 'Đã xóa tín hiệu';
  render();
});
document.querySelector('#clearAll').addEventListener('click', () => {
  code = '';
  text = '';
  hint.textContent = 'Đã xóa tất cả';
  render();
});

// --- Bộ huấn luyện k-NN ----------------------------------------------------
document.querySelectorAll('.sample-button').forEach((btn) => {
  btn.addEventListener('click', () => addSample(btn.dataset.label));
});

document.querySelector('#clearSamples').addEventListener('click', () => {
  saveSamples([]);
  renderTrainer();
  trainerStatusEl.textContent =
    `Đã xóa toàn bộ mẫu — quay về chế độ Heuristic (cần ≥ ${K_NEIGHBORS} mẫu để bật k-NN).`;
});

/** Cập nhật khu vực trainer (bộ đếm + nhãn chế độ + thông điệp mặc định). */
function renderTrainer() {
  renderModeBadges();
  const samples = loadSamples();
  if (!samples.length) {
    trainerStatusEl.textContent =
      `Chưa có mẫu nào. Giữ cử chỉ trong khung hình rồi bấm nút để lưu mẫu — cần ≥ ${K_NEIGHBORS} mẫu để bật k-NN.`;
  }
}

// --- Khởi tạo -------------------------------------------------------------
render();
renderTrainer();
