# Gemini Storybook TTS Extension

Chrome extension để tự động tạo storybook từ Gemini và chuyển đổi thành audio bằng AI Studio TTS.

## Tính năng

### 🎯 4 Bước hoàn chỉnh:
1. **Tạo Storybook trên Gemini** - Nhập prompt và tạo storybook
2. **Trích xuất nội dung** - Tự động lấy text và hình ảnh từ storybook
3. **Tạo Audio TTS** - Chuyển đổi text thành giọng nói tự nhiên
4. **Xuất kết quả** - Download file JSON/TXT với đầy đủ thông tin

### ✨ Tính năng nổi bật:
- **Side Panel UI**: Giao diện thân thiện, luôn sẵn sàng
- **Auto-save**: Tự động lưu tiến độ, có thể dừng/tiếp tục bất cứ lúc nào
- **Activity Logs**: Theo dõi chi tiết hoạt động từng bước
- **Data Management**: Xóa dữ liệu từng bước hoặc toàn bộ
- **Multi-format Export**: Xuất JSON và TXT
- **Auto-check**: Tự động kiểm tra dữ liệu storybook mỗi 30s

## Cài đặt

### Bước 1: Tải Extension
1. Tải toàn bộ folder này về máy
2. Mở Chrome và vào `chrome://extensions/`
3. Bật "Developer mode" (góc trên bên phải)
4. Click "Load unpacked" và chọn folder extension

### Bước 2: Sử dụng
1. Click vào icon extension trên thanh công cụ để mở Side Panel
2. Làm theo 4 bước trong giao diện:
   - **Bước 1**: Mở Gemini Storybook và nhập prompt
   - **Bước 2**: Trích xuất dữ liệu từ storybook đã tạo
   - **Bước 3**: Mở AI Studio và tạo audio cho từng trang
   - **Bước 4**: Xuất kết quả final

## Cách sử dụng chi tiết

### Bước 1: Tạo Storybook
1. Nhập prompt mô tả câu chuyện bạn muốn tạo
2. Click "Mở Gemini Storybook" - sẽ mở tab mới
3. Click "Gửi Prompt" để gửi prompt đến Gemini
4. Chờ Gemini tạo storybook hoàn chỉnh

### Bước 2: Trích xuất dữ liệu
1. Click "Trích xuất dữ liệu" để lấy nội dung
2. Kiểm tra bảng dữ liệu hiển thị
3. Có thể bật "Auto Check" để tự động kiểm tra mỗi 30s
4. Khi đủ dữ liệu sẽ tự động chuyển bước 3

### Bước 3: Tạo Audio
1. Tùy chỉnh "Style Instruction" cho giọng đọc
2. Click "Mở AI Studio" - sẽ mở tab mới  
3. Click "Tạo Audio" để bắt đầu quá trình TTS
4. Có thể tạm dừng/tiếp tục bất cứ lúc nào

### Bước 4: Xuất kết quả
1. Click "Xuất JSON" để tải file JSON
2. Click "Xuất TXT" để tải file text
3. Dữ liệu bao gồm đầy đủ text, hình ảnh và audio links

## Cấu trúc File

```
gemini-story-book/
├── manifest.json          # Cấu hình extension
├── background.js           # Service worker
├── sidepanel.html         # Giao diện side panel
├── sidepanel.js           # Logic chính
├── content-gemini.js      # Script cho Gemini Storybook
├── content-aistudio.js    # Script cho AI Studio TTS
├── readme.md              # File gốc với các function
└── README-INSTALL.md      # Hướng dẫn này
```

## Troubleshooting

### Lỗi thường gặp:
1. **Extension không tải được**: Kiểm tra Developer mode đã bật chưa
2. **Không gửi được prompt**: Chờ trang Gemini tải xong rồi thử lại  
3. **Không trích xuất được dữ liệu**: Đợi Gemini tạo xong storybook
4. **TTS không hoạt động**: Kiểm tra trang AI Studio đã tải xong

### Tips:
- Luôn chờ trang web tải hoàn tất trước khi thực hiện các thao tác
- Sử dụng Activity Logs để theo dõi tiến trình  
- Dữ liệu được tự động lưu, có thể đóng/mở extension bất cứ lúc nào
- Nếu có lỗi, thử clear data của bước đó và làm lại

## Phiên bản
- **v1.0.0**: Phiên bản đầu với đầy đủ 4 bước và side panel UI

## Tác giả
Extension được phát triển dựa trên logic từ file readme.md gốc.