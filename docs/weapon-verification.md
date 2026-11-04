# Weapon verification — cập nhật

Đã tìm được client Java chính thức 4.0.3 và xác minh thêm mapping vũ khí thường, metadata/hướng/offset, WPS và đòn cơ bản. Xem [bằng chứng và phạm vi renderer](client403-verification.md).

# Ghi nhận trước khi có client (đối chiếu chỉ từ server)

## Kết luận

Đã xác nhận danh sách vật phẩm, điều kiện phái/cấp từ template, slot thường/thời trang và trường ngoại hình được server gửi. **Chưa xác nhận ánh xạ từ vật phẩm sang sheet 50–53 hoặc frame/hướng/điểm cầm.** Không đưa suy đoán đó vào preview nhân vật.

Cách cũ có hai lỗi: coi 100 file ảnh là một danh sách trang bị, và diễn giải đuôi packet 32 byte thành bốn hướng/ba bộ offset cầm mà chưa có code đọc từ client. Việc các rectangle vừa kích thước PNG chỉ chứng minh geometry có vẻ hợp lý, không chứng minh ý nghĩa hoặc liên kết với vật phẩm. Parser, bảng weapon_previews và renderer gắn thử đó đã được gỡ.

## Bằng chứng server

| Bằng chứng | Đã xác nhận |
| --- | --- |
| `client/UseItem.java`, `ProcessItem3` | clazz phải trùng người chơi hoặc bằng 4; level yêu cầu không được vượt cấp người chơi. Còn kiểm tra inventory, thời gian sử dụng và trạng thái khóa — template selector không mô phỏng các trạng thái instance này. |
| `client/Player.java`, `player_wear` | type 8/9/10/11 vào wear[0]; type 24 vào wear[17]. |
| `core/Service.java`, `send_wear` | Message 15 ghi slot, name, clazz, type, icon và part của đồ đang mặc. |
| `core/Service.java`, `send_in4_other_char` | Ngoại hình gửi cho người chơi khác cũng có clazz/type/icon/part theo slot. |
| `core/Service.java`, `get_id_weapon` | Nếu wear[17] tồn tại thì trả part+41, ngược lại -1. Đây là vũ khí thời trang, không phải công thức ánh xạ vũ khí thường. |
| `client/MessageHandler.java`, case -52 | Client yêu cầu type/id; server trả file part_char/imgver/x{zoom}/{type}_{id}. Code này không chỉ ra client suy ra type/id từ item hoặc wear như thế nào. |

Đường dẫn trên tương đối với `hso/src/main/java/`.

## Kết quả SQL dump

| Phái (clazz) | type thường | Số template | Distinct part | Khoảng part |
| --- | --- | --- | --- | --- |
| Chiến binh (0) | 8 | 141 | 24 | 0–23 |
| Sát thủ (1) | 9 | 141 | 24 | 0–23 |
| Pháp sư (2) | 11 | 141 | 24 | 0–23 |
| Xạ thủ (3) | 10 | 141 | 24 | 0–23 |

Có 564 template vũ khí thường và 96 cặp (clazz, part); không đồng nghĩa 564 hoặc 96 file ảnh đã xác nhận. Nhiều template màu/cấp dùng chung part. Có thêm 9 template type24, clazz4, level150, dùng slot17. Ví dụ item4691 “Gậy tím 20” có part20 → idWeapon61; **61 không tự đồng nghĩa file 61_* hoặc *_61**.

Bốn họ ảnh 50–53 có 25 file/họ, ID0–24. Dump không có vũ khí thường type8–11 với part24. Không kết luận bốn file *_24 là trang bị, rỗng, NPC hay mặc định khi chưa có bằng chứng.

## Các suy luận bị loại bỏ

- Không coi số file, thứ tự họ hoặc hình dáng gần giống là mapping item → texture đã xác minh.
- Không áp dụng mặc định family=50+clazz, hay family=type+42. Những công thức này chưa xuất hiện ở đường xử lý server đã đọc.
- Không đặt bốn vùng ngang thành down/up/left/right, không gắn ba cặp byte với idle/walk/attack và không neo theo vị trí áo.
- Không dùng icon vật phẩm làm sheet toàn thân hoặc vũ khí trên tay.
- Không dùng part+41 của wear[17] cho wear[0].

## Hiện trạng Studio

Danh sách vật phẩm thật được lọc theo phái và kiểm tra cấp template. Vũ khí thường và thời trang nằm ở hai selector riêng, có ID/type/part/slot và giá trị idWeapon đã xác minh. Chọn vật phẩm chỉ đối chiếu dữ liệu; không tạo lớp vũ khí hoặc xuất sprite/atlas vũ khí.

Để dựng đúng ngoại hình cần mã client xử lý message15/ngoại hình và request -52, hoặc một bảng mapping/rig gốc đủ định danh phiên bản. Dữ liệu server hiện có chưa đủ để xác nhận phần dựng hình. Chuỗi tấn công thân người đã có vẫn được ghi riêng là thử nghiệm, không nâng thành dữ liệu HSO đã xác minh.
