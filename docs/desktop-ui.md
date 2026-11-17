# Desktop UI

Quyết định ngày 2026-11-09: làm lại bố cục cả ba route; chỉ ưu tiên desktop/laptop; Character Lab dùng một preview chung với tab Trang bị / Animation / Tinh chỉnh. Giữ các chức năng và dữ liệu HSO hiện có.

## Cách dùng

- Character Lab: thay ngoại hình trong Trang bị, chọn trạng thái/chiêu và play/pause/step trong Animation, chỉnh crop/vị trí/thứ tự lớp trong Tinh chỉnh. Đổi tab không reset trang bị hoặc đồng hồ. Bốn hình thu nhỏ đổi hướng của preview chính. Khi có hiệu ứng chiêu đã hỗ trợ, khung hiệu ứng thay khung ghép trong cùng vùng xem. Zoom/Căn giữa áp dụng cho khung ghép; chiêu tự vừa khung.
- Thư viện dữ liệu: chọn danh mục phía trên, lọc/tìm trong vùng giữa, chọn kết quả để xem và sửa nháp bên phải. Xuất nháp tại thanh công cụ của trang; xuất nhân vật/thư viện part tại Character Lab.
- Map: công cụ và palette bên trái; canvas ở giữa; chi tiết ô/vật thể bên phải. Trên laptop nhỏ, chi tiết chuyển xuống dưới để giữ chiều rộng canvas. Giữ nguyên phím tắt chỉnh map. Nguồn và giới hạn vẫn có trong các phần mở rộng.

## Phạm vi

Không thay dữ liệu, thuật toán animation, format ZIP hoặc cơ chế lưu. Mỗi panel dài cuộn độc lập. Navigation dùng KeepAlive, giữ trạng thái khi đổi route và dừng đồng hồ animation khi rời Character Lab. Nháp vẫn chỉ ở trong tab; tải file trước khi reload.

Không bổ sung tính năng gameplay, autosave, asset mới hoặc layout tối ưu điện thoại. Các thông tin chưa xác minh vẫn giữ nhãn nguồn/giới hạn.

## Kiểm chứng

Kiểm thử UI tại 1024, 1280 và 1440px, đổi tab bằng chuột/bàn phím, trang bị → animation → chiêu → tinh chỉnh; quay lại route; sửa nháp dữ liệu và map. Bộ kiểm thử cũ được cập nhật thao tác qua tab, giữ kiểm tra dữ liệu xuất và runtime Phaser.

## Soi asset theo frame

Trong Character Lab → Animation, chọn **Soi asset theo frame**. Khi mở, animation tự dừng; khung bên dưới bốn hướng hiển thị hình ghép và các sheet gốc có đánh dấu crop. Đổi hướng bằng selector hoặc bốn preview, kéo thanh Frame, dùng Frame trước/sau hoặc phát khi soi. Crop pixel đã nhân density; crop và vị trí ghép logical giữ đơn vị x1. Chú giải có số khung, lật ảnh, transform hiệu ứng và thứ tự lớp. Các lần dùng cùng vùng crop trên cùng sheet chia sẻ nhãn số; lớp bị ẩn được liệt kê riêng.

Ảnh ghép dùng cùng resolvePose/paintLayers với preview, gồm part đang trang bị, WPS, thú cưỡi/pet, danh hiệu và hiệu ứng kỹ năng khi preview hỗ trợ. Hiệu ứng dùng cùng scene/painter hiện có; các nét vẽ bằng code có ghi chú và không tạo sheet giả. Khung mục tiêu mẫu không được đưa vào hình ghép asset. Nhịp thở/chiêu thử nghiệm và các giới hạn chưa khôi phục vẫn giữ ý nghĩa của preview, không được xác nhận thành dữ liệu HSO gốc.

Mặc định sheet vừa chiều rộng thẻ; bật **Xem sheet đúng kích thước pixel** để xem 1:1 và cuộn sheet lớn. Đây là công cụ chỉ xem trên màn hình, không tạo ZIP/file hoặc thay đổi asset, không sửa các chức năng xuất hiện có.
