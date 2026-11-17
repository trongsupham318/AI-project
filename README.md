<div align="center">

# ✋ Morse Hand

### Chạm tay, viết Morse — Nhận diện cử chỉ bàn tay qua webcam để nhập và giải mã mã Morse theo thời gian thực.

<br/>

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Vanilla JavaScript](https://img.shields.io/badge/Vanilla_JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![MediaPipe Hands](https://img.shields.io/badge/MediaPipe_Hands-0097A7?style=for-the-badge&logo=google&logoColor=white)
![k-NN](https://img.shields.io/badge/k--NN-k%3D5-c9f26b?style=for-the-badge&labelColor=17201c)
![A* Search](https://img.shields.io/badge/A*_Search-Levenshtein-ff7446?style=for-the-badge)

</div>

---

## 📖 Giới thiệu

**Morse Hand** là một ứng dụng web (*web application*) cho phép người dùng nhập mã Morse (*Morse code*) mà không cần bàn phím — chỉ bằng cử chỉ bàn tay trước webcam.

Ứng dụng sử dụng **MediaPipe Hands** để theo dõi 21 điểm mốc (*landmarks*) trên bàn tay theo thời gian thực (*real-time hand tracking*). Từ 21 điểm mốc đó, hệ thống trích xuất **vector đặc trưng 42 chiều** và phân loại cử chỉ bằng thuật toán **k-NN (k = 5)** có trọng số nghịch đảo khoảng cách, từ đó suy ra tín hiệu chấm (`.`) hoặc gạch (`-`). Các tín hiệu được cộng dồn vào một bộ đệm (*buffer*); thuật toán **A\* Search** trên cây nhị phân Morse (heuristic = khoảng cách Levenshtein) gợi ý **Top 3 ký tự gần nhất** và tự sửa lỗi khi chuỗi tín hiệu bị dư/thiếu. Đây là hai thuật toán cốt lõi của đồ án môn **Trí tuệ nhân tạo**, được cài đặt 100% bằng Vanilla JavaScript — không dùng thư viện ML ngoài MediaPipe.

Toàn bộ quá trình xử lý diễn ra ngay trên trình duyệt (*client-side*) — không cần backend, không cần cài đặt thư viện qua `npm`, chỉ cần mở trang web và cấp quyền camera.

### ✨ Tính năng chính

- 🎥 **Nhận diện bàn tay theo thời gian thực** — Theo dõi tối đa 1 bàn tay (`maxNumHands: 1`) với độ tin cậy phát hiện và theo dõi (*detection/tracking confidence*) ở mức `0.7`.
- 🧠 **Phân loại cử chỉ bằng k-NN** — `extractFeatureVector()` chuẩn hoá 21 landmark thành vector 42 chiều bất biến với vị trí/khoảng cách camera; `classifyWithKNN()` tìm 5 láng giềng gần nhất theo khoảng cách Euclidean và bỏ phiếu có trọng số `1/(d+ε)` cho 3 nhãn `dot` / `dash` / `neutral`.
- 🎓 **Interactive Trainer (huấn luyện trực tiếp)** — Ba nút `+ Mẫu Chấm`, `+ Mẫu Gạch`, `+ Mẫu Chờ` kèm bộ đếm và nút `Xóa mẫu`; bộ dữ liệu được lưu vào `localStorage` nên không mất khi tải lại trang. Khi chưa đủ `k = 5` mẫu, hệ thống tự động dùng **heuristic dự phòng** dựa trên tỷ lệ khoảng cách đầu ngón / khớp giữa so với cổ tay (bất biến với góc nghiêng tay), và trạng thái `k-NN` / `Heuristic` được hiển thị ngay trên thanh tiêu đề camera.
- 🔭 **A\* Search gợi ý & tự sửa lỗi** — `aStarMorseSearch()` duyệt cây nhị phân Morse với `f(n) = g(n) + h(n)`, trong đó `g(n)` là độ sâu và `h(n)` là khoảng cách Levenshtein tới chuỗi người dùng nhập. Top 3 ký tự gần nhất hiện thành **chip bấm được** (bấm để chốt ngay); nếu mã nhập không khớp từ điển, `commitLetter()` dùng kết quả Top 1 để sửa lỗi thay vì in ký tự `�`.
- 🔤 **Giải mã Morse đầy đủ A–Z và 0–9** — Bảng tra cứu `MORSE` gồm 36 ký tự; mã không hợp lệ sẽ hiển thị ký tự thay thế `�` kèm thông báo *"Mã chưa hợp lệ"* thay vì gây lỗi.
- ⏱️ **Cơ chế chống trùng lặp (*anti-repeat / cooldown*)** — Một tín hiệu chỉ được ghi nhận khi cử chỉ **thay đổi** so với cử chỉ trước đó **và** đã qua `800ms` kể từ tín hiệu cuối cùng, tránh việc giữ nguyên một cử chỉ bị ghi thành nhiều ký tự.
- 🦴 **Vẽ khung xương bàn tay trực tiếp lên Canvas** — Hiển thị các đường nối (*connectors*) và điểm mốc (*landmarks*) theo thời gian thực ngay trên khung hình camera (đã lật gương — *mirrored* — để thao tác tự nhiên).
- 🔔 **Phản hồi trạng thái trực quan (*live feedback*)** — Huy hiệu cử chỉ (*gesture badge*: "Nắm tay · dấu chấm" / "Bàn tay mở · dấu gạch"), trạng thái camera (*"Đang nhận diện"*, *"Không thể mở camera"*) và gợi ý tín hiệu gần nhất (*signal hint*: "Đã thêm chấm", "→ A"...) cập nhật liên tục theo từng hành động.
- ✍️ **Thao tác biên tập văn bản thủ công** — Các nút **Thêm chữ** (chốt ký tự), **Dấu cách** (chốt ký tự + thêm khoảng trắng), **Xóa tín hiệu** (xóa chấm/gạch cuối trong bộ đệm hiện tại) và **Xóa tất cả** (xóa toàn bộ văn bản + bộ đệm).
- ♿ **Hỗ trợ tiếp cận (*accessibility*)** — Vùng văn bản đã giải mã dùng thuộc tính `aria-live="polite"` để trình đọc màn hình (*screen reader*) thông báo kết quả mới.
- 📱 **Giao diện đáp ứng (*responsive layout*)** — Bố cục lưới (*CSS Grid*) hai cột trên desktop tự chuyển thành một cột ở màn hình ≤ `720px`.

---

## ⚙️ Cách hoạt động

### 🔄 Luồng xử lý (*Processing Pipeline*)

```mermaid
flowchart LR
    A[Webcam 640×480<br/>getUserMedia] --> B[MediaPipe Hands<br/>21 landmarks]
    B --> C[extractFeatureVector<br/>chuẩn hoá 42 chiều]
    C --> D{Đủ k = 5 mẫu?}
    D -->|Không| E[heuristicGesture<br/>tỷ lệ d_i / d_pip]
    D -->|Có| F[classifyWithKNN<br/>Euclidean + trọng số 1/d]
    E --> G[dot / dash / neutral]
    F --> G
    G --> H{Kiểm tra cooldown<br/>800ms + đổi cử chỉ?}
    H -->|Hợp lệ| I[Buffer mã Morse]
    I --> J[aStarMorseSearch<br/>f = g + Levenshtein]
    J --> K[Top 3 chip gợi ý]
    J --> L{Mã khớp<br/>từ điển?}
    L -->|Có| M[Ký tự chính xác]
    L -->|Không| N[A* Top 1<br/>tự sửa lỗi]
    M --> O[Văn bản đã giải mã]
    N --> O
```

### 🤚 Quy tắc cử chỉ (*Gesture Rules*)

| Cử chỉ / Thao tác | Cách thực hiện | Kết quả | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- |
| ✊ **Nắm tay** | Gập các ngón tay lại (≤ 1 ngón duỗi) | Nhập dấu chấm **`.`** | Nhãn `dot` — k-NN (hoặc heuristic dự phòng) |
| 🖐️ **Mở bàn tay** | Duỗi thẳng các ngón tay (hiển thị 5 ngón; code ghi nhận khi ≥ 4 ngón duỗi) | Nhập dấu gạch **`-`** | Nhãn `dash` — k-NN (hoặc heuristic dự phòng) |
| ✌️ **Trạng thái trung gian (*Neutral*)** | Duỗi 2–3 ngón tay | Không ghi nhận tín hiệu | Nhãn `neutral`; dùng để "nhả" cử chỉ trước khi nhập tín hiệu tiếp theo |
| ⏳ **Thời gian chờ (*Cooldown*)** | Giữ/đổi cử chỉ sau mỗi tín hiệu | Chờ tối thiểu **0.8 giây** (`800ms`) | Tín hiệu mới chỉ được chấp nhận khi cử chỉ **khác** cử chỉ trước **và** đã qua thời gian cooldown kể từ tín hiệu cuối |
| 🔘 **Nút "Thêm chữ"** | Nhấn nút trên giao diện | Chốt (*commit*) cụm chấm/gạch hiện tại thành 1 ký tự | Tra bảng `MORSE`; nếu không khớp, **A\* Top 1 tự sửa lỗi** |
| ␣ **Nút "Dấu cách"** | Nhấn nút trên giao diện | Chốt ký tự hiện tại **và** thêm khoảng trắng | Tương đương "Thêm chữ" + ký tự `' '` |
| ⌫ **Nút "Xóa tín hiệu"** | Nhấn nút trên giao diện | Xóa chấm/gạch **cuối cùng** trong bộ đệm chưa chốt | Chỉ tác động lên mã đang nhập dở, không xóa ký tự đã chốt |
| 🗑️ **Nút "Xóa tất cả"** | Nhấn nút trên giao diện | Xóa toàn bộ văn bản đã dịch và bộ đệm hiện tại | Đặt lại ứng dụng về trạng thái ban đầu |

> 💡 **Mẹo sử dụng:** Sau khi ra dấu chấm/gạch, hãy chuyển tay về trạng thái trung gian (duỗi 2–3 ngón) hoặc đổi sang cử chỉ khác rồi quay lại — đây là thao tác bắt buộc để hệ thống ghi nhận tín hiệu tiếp theo, vì giữ nguyên một cử chỉ sẽ **không** bị tính lặp lại nhiều lần.

> 🧠 **Vì sao k-NN tốt hơn cách đếm ngón cũ?** Cách cũ (`fingersUp()`) phụ thuộc trục `y` của khung hình và so sánh toạ độ `x` cho ngón cái, nên sai lệch khi xoay nghiêng tay hoặc đổi tay trái/phải. Vector đặc trưng 42 chiều ở đây đã loại bỏ ảnh hưởng của **vị trí** và **khoảng cách camera**; k-NN học trực tiếp từ mẫu người dùng thu thập nên thích nghi với chính bàn tay và ánh sáng của bạn. Mẹo: thu thập mẫu ở **nhiều góc tay khác nhau** để bộ phân loại bền vững hơn.

> 🎓 **Chế độ heuristic:** Khi chưa có đủ `5` mẫu, ứng dụng vẫn chạy được bằng heuristic tỷ lệ khoảng cách (đã bất biến với góc nghiêng). Nhãn chế độ hiển thị ở góc phải thanh tiêu đề camera (`Heuristic` màu xám → `k-NN · k=5` màu xanh `--lime`).

---

## 🧠 Hai thuật toán cốt lõi (*AI Algorithms*)

### 1️⃣ k-NN — Phân loại cử chỉ bàn tay

**Trích xuất đặc trưng** — `extractFeatureVector(landmarks)`:

| Bước | Công thức | Ý nghĩa |
| :--- | :--- | :--- |
| 1. Tịnh tiến | `p'_i = p_i − p_0` | Lấy cổ tay `lm[0]` làm gốc `(0, 0)` → bất biến với **vị trí** tay trong khung hình |
| 2. Tỷ lệ | `d_max = max_i ‖p'_i‖`, `v_i = p'_i / d_max` | Bất biến với **khoảng cách camera**, mọi toạ độ rơi vào `[-1, 1]` |
| 3. Ghép vector | `v = [x_0, y_0, …, x_20, y_20] ∈ ℝ⁴²` | Vector 42 chiều mô tả thuần **hình dạng** bàn tay |

**Phân loại** — `classifyWithKNN(landmarks)`:

```
1. v ← extractFeatureVector(landmarks)                       // v ∈ ℝ⁴²
2. nếu |dataset| < k  →  heuristicGesture(landmarks)          // dự phòng
3. d_i = ‖v − sample_i‖₂ = sqrt( Σ_j (v_j − s_ij)² )          // Euclidean, ℝ⁴²
4. lấy k = 5 mẫu có d_i nhỏ nhất
5. w_i = 1 / (d_i + ε)                                       // trọng số nghịch đảo
   score[label] = Σ w_i  (với mọi láng giềng có nhãn đó)
6. nhãn = argmax score ;  confidence = score / Σ score
```

- **Nhãn:** `'dot'` (nắm tay) · `'dash'` (mở 5 ngón) · `'neutral'` (trạng thái chờ).
- **Heuristic dự phòng** (khi chưa đủ `k` mẫu): với mỗi ngón, tính
  `ratio = d(cổ tay → đầu ngón) / d(cổ tay → khớp giữa)`. Ngón duỗi cho `ratio > 1`, ngón gập cho `ratio < 1`.
  Vì chỉ dùng **tỷ lệ khoảng cách** (bất biến với phép quay và co giãn), heuristic **không phụ thuộc góc nghiêng tay** — khắc phục hạn chế của cách đếm ngón cũ.
- **Lưu trữ:** mỗi mẫu là `{ label, v: number[42] }`, tối đa 120 mẫu/nhãn, lưu tại khoá `morseHand.knnSamples.v1` trong `localStorage`.

### 2️⃣ A\* Search — Gợi ý & sửa lỗi mã Morse

Không gian trạng thái trên **cây nhị phân Morse**:

| Thành phần | Định nghĩa |
| :--- | :--- |
| Trạng thái | Chuỗi tín hiệu (tiền tố mã Morse), ví dụ `".-"` |
| Trạng thái đầu | `""` (gốc cây) |
| Sinh kế vị | Nối thêm `'.'` (nhánh trái) hoặc `'-'` (nhánh phải) |
| Độ sâu tối đa | `5` (mã Morse dài nhất trong bảng là 5 tín hiệu) |
| Trạng thái đích | Node có khoá trong bảng `MORSE` |

Hàm đánh giá:

```
f(n) = g(n) + h(n)
  g(n) = độ sâu của node n                        (chi phí thực đã đi)
  h(n) = levenshtein(n.code, code)                (ước lượng chi phí còn lại)
```

**Levenshtein** (quy hoạch động, bộ nhớ `O(n)`):

```
D[i][0] = i ;  D[0][j] = j
D[i][j] = min( D[i-1][j] + 1,                    // xoá
               D[i][j-1] + 1,                    // chèn
               D[i-1][j-1] + (a[i] ≠ b[j]) )     // thay thế
```

Ví dụ thực tế với `code = ".-...."` (dư 1 tín hiệu):

| Ứng viên | Mã | `h` (Levenshtein) | `g` | `f` |
| :--- | :--- | :--- | :--- | :--- |
| `5` | `.....` | 1 | 5 | 6 |
| `6` | `-....` | 1 | 5 | 6 |
| `L` | `.-..` | 2 | 4 | 6 |

→ Top 1 được dùng để **tự sửa lỗi** khi `commitLetter()` không tìm thấy mã chính xác; Top 3 hiện thành chip gợi ý dưới dòng `morseInput`.

### ⚡ Tối ưu hiệu năng

- Camera được yêu cầu ở độ phân giải **640×480** (thay vì 1280×720) — đủ chính xác cho 21 landmark nhưng nhẹ CPU/GPU hơn đáng kể.
- `canvas.width` / `canvas.height` **chỉ được gán khi kích thước video thực sự thay đổi** (`lastCanvasW` / `lastCanvasH`). Gán lại hai thuộc tính này sẽ reset toàn bộ context 2D và gây tốn tài nguyên mỗi khung hình.
- A\* chỉ chạy khi chuỗi `code` thay đổi (trong `render()`), không chạy theo từng frame camera.

## 🛠️ Công nghệ sử dụng (*Tech Stack*)

| Công nghệ | Vai trò trong dự án |
| :--- | :--- |
| **HTML5** | Cấu trúc trang (`index.html`): thẻ `<video>` nhận luồng camera, `<canvas>` vẽ kết quả, bố cục *semantic* với `<main>`, `<section>`, `<aside>` |
| **CSS3** | Giao diện (`style.css`): CSS Custom Properties (*variables*), CSS Grid, Flexbox, `clamp()` cho *fluid typography*, Media Query `@media (max-width: 720px)` cho responsive, hiệu ứng lật gương `transform: scaleX(-1)` |
| **Vanilla JavaScript (ES6+)** | Toàn bộ logic (`app.js`): không framework, không bundler — dùng `async/await`, arrow function, optional chaining (`?.`), template literals |
| **[MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)** (`@mediapipe/hands`) | Mô hình *machine learning* phát hiện và trích xuất 21 landmarks 3D của bàn tay từ từng khung hình; cấu hình `modelComplexity: 1`, `minDetectionConfidence: 0.7`, `minTrackingConfidence: 0.7`; file mô hình (`.wasm`, `.tflite`) được tải qua `locateFile` từ CDN jsDelivr |
| **[Camera Utils](https://www.npmjs.com/package/@mediapipe/camera_utils)** (`@mediapipe/camera_utils`) | Tiện ích `Camera` bơm từng khung hình từ `<video>` vào MediaPipe qua callback `onFrame` ở độ phân giải 1280×720 |
| **[Drawing Utils](https://www.npmjs.com/package/@mediapipe/drawing_utils)** (`@mediapipe/drawing_utils`) | Cung cấp `drawConnectors()` + `HAND_CONNECTIONS` và `drawLandmarks()` để vẽ khung xương (màu `#c9f26b`) và các điểm khớp (màu `#ff7446`) lên Canvas |
| **MediaDevices `getUserMedia`** (WebRTC / Media Capture API) | Yêu cầu quyền và mở luồng webcam trực tiếp từ trình duyệt: `facingMode: 'user'`, độ phân giải lý tưởng **640×480**, không thu âm (`audio: false`); có xử lý lỗi (*try/catch*) khi người dùng từ chối quyền |
| **HTML5 Canvas 2D API** | Bề mặt vẽ (*rendering surface*): đồng bộ kích thước theo `videoWidth`/`videoHeight`, vẽ khung hình gốc (`drawImage`) rồi chồng lớp khung xương lên trên theo từng frame |
| **Google Fonts** | Bộ đôi font chữ **Manrope** (nội dung) và **DM Mono** (hiển thị mã Morse/monospace) qua `@import` trong CSS |
| **Web Storage API (`localStorage`)** | Lưu bền bộ dữ liệu mẫu huấn luyện k-NN (khoá `morseHand.knnSamples.v1`) để bộ phân loại không bị "quên" sau khi tải lại trang |
| **Thuật toán tự cài đặt** | **k-NN** (Euclidean ℝ⁴² + bỏ phiếu trọng số nghịch đảo khoảng cách) và **A\*** (cây nhị phân Morse + heuristic Levenshtein) — 100% Vanilla JS, không thư viện ML |

> 📦 Cả ba thư viện MediaPipe đều được nạp trực tiếp từ CDN (`cdn.jsdelivr.net`) bằng thẻ `<script>` — dự án **không có** `package.json` và không cần bước build (*zero-build setup*).

---

## 🚀 Hướng dẫn cài đặt & chạy dự án (*Local Setup*)

### Yêu cầu tiên quyết (*Prerequisites*)

- Một trình duyệt hiện đại có hỗ trợ `getUserMedia` và WebAssembly (khuyến nghị **Google Chrome** hoặc **Microsoft Edge** bản mới nhất).
- Webcam (tích hợp hoặc USB).
- Kết nối Internet trong lần tải đầu tiên (để tải thư viện MediaPipe, mô hình nhận diện tay và Google Fonts từ CDN).

### ⚠️ Lưu ý quan trọng về quyền Webcam

> Trình duyệt **chỉ cho phép truy cập webcam trong *secure context*** — tức là trang web phải được phục vụ qua **`https://`** hoặc **`http://localhost`**.
>
> ❌ Mở file trực tiếp bằng giao thức `file://` (nhấp đúp vào `index.html`) sẽ bị trình duyệt chặn quyền camera và ứng dụng không hoạt động.
>
> ✅ Hãy chạy một trong các cách dưới đây để phục vụ dự án qua `localhost`.

### Cách 1: VS Code Live Server (khuyến nghị cho người mới)

1. Mở thư mục dự án bằng **Visual Studio Code**.
2. Cài extension **Live Server** (tác giả: Ritwick Dey) từ Marketplace.
3. Nhấn chuột phải vào `index.html` → **Open with Live Server** (hoặc nhấn nút **Go Live** ở góc dưới-phải).
4. Trình duyệt tự mở tại `http://localhost:5500` (cổng mặc định). Nhấn **"Bật camera"** và cho phép quyền truy cập webcam.

### Cách 2: Python `http.server`

```bash
# Di chuyển vào thư mục dự án
cd morse-hand

# Python 3
python -m http.server 8000
```

Sau đó mở trình duyệt và truy cập: **http://localhost:8000**

### Cách 3: Node.js với `serve`

```bash
# Di chuyển vào thư mục dự án
cd morse-hand

# Chạy trực tiếp không cần cài đặt
npx serve .
```

Sau đó mở trình duyệt tại địa chỉ được hiển thị trên terminal (mặc định: **http://localhost:3000**).

### Bắt đầu sử dụng

1. Nhấn nút **"Bật camera"** và cấp quyền webcam khi trình duyệt yêu cầu.
2. Đưa **một bàn tay** vào khung hình, giữ lòng bàn tay hướng vào camera — chờ huy hiệu hiển thị *"Nắm tay · dấu chấm"* hoặc *"Bàn tay mở · dấu gạch"*.
3. ✊ Nắm tay để nhập `.` — 🖐️ mở tay để nhập `-` (nhớ đổi về trạng thái trung gian giữa hai tín hiệu liên tiếp).
4. Nhấn **"Thêm chữ"** để chốt ký tự, **"Dấu cách"** để cách từ, lặp lại cho đến khi hoàn thành thông điệp.

---

## 📁 Cấu trúc thư mục (*Project Structure*)

```text
morse-hand/
│
├── index.html    # Cấu trúc giao diện & nạp thư viện qua CDN
├── style.css     # Toàn bộ định dạng giao diện (layout, responsive, theme)
├── app.js        # k-NN + A* + MediaPipe + logic giải mã Morse & sự kiện UI
└── README.md     # Tài liệu dự án (file này)
```

| File | Vai trò chi tiết |
| :--- | :--- |
| `index.html` | Khai báo khung giao diện gồm 3 khối: **Hero** (tiêu đề/giới thiệu), **Workspace** (thẻ camera chứa `<video>` + `<canvas>` + huy hiệu cử chỉ, và thẻ *decoder* hiển thị bản dịch, mã đang nhập cùng các nút thao tác), **Guide** (3 thẻ hướng dẫn cử chỉ nhanh). Nạp 3 thư viện MediaPipe (`camera_utils`, `drawing_utils`, `hands`) từ CDN jsDelivr và `app.js` ở cuối `<body>`. |
| `style.css` | Định nghĩa design tokens qua CSS variables (`--ink`, `--paper`, `--lime`, `--orange`...), hệ thống layout Grid/Flexbox, trạng thái chấm "live" đổi màu cam kèm vòng sáng khi camera bật, hiệu ứng gương cho video/canvas, và breakpoint responsive tại `720px`. |
| `app.js` | "Bộ não" của ứng dụng, tổ chức thành 5 phần có comment toán học: **(0)** bảng `MORSE` + DOM, **(1)** k-NN: `extractFeatureVector()`, `euclideanDistance()`, `heuristicGesture()`, `classifyWithKNN()`, `addSample()` và lưu `localStorage`, **(2)** A\*: `levenshtein()`, `aStarMorseSearch()`, **(3)** bộ đệm & UI: `render()`, `renderSuggestions()`, `renderModeBadges()`, `commitLetter()`, `applyGesture()`, **(4)** MediaPipe/Canvas/Camera: `onResults()` (chỉ resize canvas khi cần), `startCamera()` (640×480), **(5)** gắn sự kiện. |

---

## 🗺️ Định hướng phát triển (*Roadmap*)

Các tính năng dưới đây **chưa có** trong phiên bản hiện tại và được đề xuất cho các bản nâng cấp tiếp theo:

- [ ] ⏲️ **Tự động chốt chữ theo thời gian chờ (*auto-commit*)** — Tự động gọi `commitLetter()` sau một khoảng im lặng (ví dụ 1.5 giây không có tín hiệu mới), và tự thêm dấu cách sau khoảng chờ dài hơn, giúp nhập liệu rảnh tay hoàn toàn.
- [ ] 🔊 **Âm thanh bíp Morse qua Web Audio API** — Phát tiếng *beep* ngắn cho dấu chấm và dài cho dấu gạch bằng `AudioContext` + `OscillatorNode`, kèm nút bật/tắt âm lượng.
- [ ] 📖 **Bảng tra cứu ký tự Morse (*cheat sheet*)** — Hiển thị bảng tham chiếu đầy đủ A–Z, 0–9 ngay trên giao diện (dạng lưới hoặc modal) để người dùng mới tra cứu nhanh mà không cần rời trang.
- [ ] 🧪 **Đánh giá mô hình k-NN** — hiển thị ma trận nhầm lẫn (*confusion matrix*) và độ chính xác trên tập kiểm thử tách riêng, phục vụ phần thực nghiệm của báo cáo.
- [ ] 🤟 **Nhận diện đa cử chỉ (*multi-gesture*)** — Mở rộng bộ cử chỉ vượt ra ngoài nắm/mở tay: ví dụ giơ ngón cái để xóa, chữ "V" (*peace sign*) để thêm dấu cách, cho phép thao tác hoàn toàn bằng tay không cần nhấn nút.
- [ ] 👐 **Hỗ trợ nhận diện hai tay (*multi-hand tracking*)** — Tăng `maxNumHands` lên 2 và phân biệt tay trái/phải để gán chức năng riêng cho từng tay.
- [ ] 🎯 **Nhận diện cử chỉ dựa trên thời lượng giữ (*hold-duration*)** — Phân biệt chấm/gạch theo *thời gian giữ* một cử chỉ duy nhất (giữ ngắn = chấm, giữ lâu = gạch) kèm thanh tiến trình trực quan, giảm mỏi tay khi nhập chuỗi dài.
- [ ] 📝 **Chế độ luyện tập (*practice mode*) & kiểm tra** — Sinh ký tự ngẫu nhiên, chấm điểm độ chính xác và tốc độ nhập Morse của người dùng.
- [ ] 💾 **Lưu & chia sẻ kết quả** — Nút sao chép (*copy to clipboard*), tải văn bản đã dịch xuống dạng file `.txt`, và lưu lịch sử phiên làm việc vào `localStorage`.
- [ ] 🌗 **Chế độ sáng/tối (*dark mode*) & đa ngôn ngữ (*i18n*)** — Cho phép chuyển đổi theme và chuyển giao diện Việt/Anh.

---

<div align="center">

**Morse Hand** — *Khi đôi tay thay lời muốn nói.* 🤟

</div>
