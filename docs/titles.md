# Danh hiệu cá nhân

Studio hỗ trợ11 danh hiệu type27 trong bộ server, item4720–4727 và4765–4767. Tên/chữ trong PNG là nội dung của server này; không khẳng định đó là danh hiệu chính thức của HSO. Danh hiệu độc lập với bang (`myClan`) và tổ đội (`party`).

## Dùng Studio

Trong “Thay bộ phận trực tiếp trên nhân vật”, chọn “Danh hiệu”. “Không dùng” tháo danh hiệu. Lựa chọn không bị giới hạn phái/cấp; đây là preview ngoại hình, không thay đổi DB hoặc cấp quyền sở hữu trong game. Ảnh giữ x4 gốc; nhịp thở không làm danh hiệu co giãn. Bốn hướng giữ cùng hình và flip của từng mảnh theo metadata, không mirror toàn danh hiệu khi quay phải.

FrameName đổi mỗi5tick client25Hz (5FPS), không phụ thuộc chu kỳ idle/walk/attack. Đổi trạng thái không khởi động lại đồng hồ danh hiệu; thay danh hiệu khởi động lại đồng hồ trong runtime. Các danh hiệu1frame đứng yên. Khi cưỡi, vị trí nâng theo dyMount; ghế Chuột tuyết/Ma mút vẫn giữ cảnh báo chưa xác minh, không được danh hiệu sửa lại.

Các khung hướng tự thu vừa toàn bộ bounds danh hiệu. Demo arena chưa có renderer danh hiệu nên nút H5 bị khóa khi đang chọn; preview và runtime ZIP hỗ trợ. Bản xuất tư thế giữ frame đang xem, còn ZIP thư viện giữ đủ chu kỳ.

## Nguồn và tọa độ

- `Player` server đọc `id_name`: với11 item nêu trên, effectID = part+41. Item khác có fallback78 nên không suy rộng công thức sang mọi vật phẩm.
- `Service.send_char_main_in4` gửi `idName`; client `ReadMessenge` nhận riêng, `MainObject.getEffMatNa` yêu cầu packet113.
- `DataSkillEff.loadData` đọc SmallImage và PartFrame (x,y,image,flip,onTop). `FrameEff` gán nhóm onTop0 vào listPartTop. Chạy paintBottomName rồi paintTopName; cả hai sau actor, transform0 ở mọi hướng. Dữ liệu sequence/phần đuôi không dùng làm timeline danh hiệu.
- `MainObject.paintPlayer` đặt gốc danh hiệu ở y-dyMount; gốc cơ thể/mount ở y-ysai-dyMount. `Player` và `Other_Players` có ysai2; do đó binding.originOffsetY2 là chênh lệch gốc có trong client, không phải căn chỉnh theo mắt.
- Logical units là x1. Crop nhân density4 khi đọc PNG. Không thay tọa độ theo số pixel x4.

`src/data/titles.json` giữ PNG checksum, raw metadata và checksum các class client. Runtime/build chỉ dùng dữ liệu đã đóng gói; không đọc HSO, JAR, Java, Python hoặc project scripts.

## ZIP v1 / Phaser

```text
titles/<itemId>/sheet.png
titles/<itemId>/atlas.json
titles/<itemId>/title.json
titlePose.js
```

`library.json` có `titles` và `titleAtlases` riêng; không giả danh hiệu là pet hoặc part cơ thể. `character.json.title` giữ lựa chọn đang xem. Reindex kiểm tra hình học, PNG và tham chiếu item/nhân vật trước khi ghi dữ liệu sinh.

```js
character.setTitle(4720);
character.equipItem(4724); // danh hiệu KnightMaster
character.setTitle(null);
```

Thay title thất bại giữ lựa chọn trước; sprite của title được tái sử dụng theo mảnh và hủy khi tháo/thay. Gói v1 cũ không có trường titles vẫn chạy được.

## Kiểm tra

Unit kiểm tra11PNG/raw checksum, mapping, crop, nhịp5tick, thứ tự pass, bốn hướng, tọa độ khi cưỡi và bounds. Chrome chọn tất cả danh hiệu, kiểm tra pause/step, chu kỳ độc lập với attack, xuất tư thế/ZIP và nạp thư viện trong Phaser thật. Kiểm tra chọn theo item ID, tháo, thiếu ID giữ title cũ và pool sprite không tăng theo số frame. Bài kiểm thử thư viện chung cũng chạy reindex với11 folder danh hiệu.
