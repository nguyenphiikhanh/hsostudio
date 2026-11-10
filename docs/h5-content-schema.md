# MySQL H5 content contract v1

Studio hiện xuất **SQL để xem/sao chép**, không tải file SQL. Đích là schema H5 mới trong MySQL 8.0.21+ (đã thử MySQL8.4), không phải schema Java HSO cũ. Đây là hợp đồng dữ liệu để backend H5 sau này đọc; chưa phải server game đã chạy.

## Chạy một lần

Trong Character Lab → Trang bị → Thiết kế part, mở **Khởi tạo MySQL H5 · chạy một lần**, bấm **Sao chép SQL**. Chọn database H5 trong công cụ MySQL rồi chạy toàn bộ script, bao gồm khối `DELIMITER` tạo procedure. Script nguồn nằm tại `src/lib/partDesign/h5Schema.sql`; UI hiển thị đúng nội dung đó.

Chỉ tạo các bảng có tiền tố h5_ và procedure `h5_register_part_v1`. Không tạo/chọn database thay bạn, không sửa item3/item4 hay bảng người chơi cũ. Không DROP bảng hoặc xóa dữ liệu. Script khởi tạo chạy một lần; schema/routine khác phiên bản cần migration rõ ràng, không tự ghi đè procedure đang có.

| Bảng | Vai trò |
|---|---|
| h5_content_state | schema_version và revision tăng sau mỗi đăng ký thành công |
| h5_rigs | Registry renderer contract v1, không phải switch theo từng vật phẩm |
| h5_parts | ID/loại/tên, rig, toàn bộ geometry/anchor, animation JSON, nguồn/checksum nội dung |
| h5_assets | PNG role, đường dẫn, SHA-256, width/height/density |
| h5_item_templates | Vật phẩm tham chiếu part, điều kiện và chỉ số, nguồn mẫu |

## Đăng ký một thiết kế

1. Trong Studio chọn mẫu, tải PNG mới, đặt ID/tên/ID vật phẩm H5 và Preview.
2. Tải ZIP PNG/JSON. Chép thư mục `assets/` trong ZIP vào asset root của server, giữ nguyên các thư mục bên trong.
3. Mở **SQL MySQL H5 · xem / sao chép**, bấm **Sao chép SQL**, chạy câu `CALL h5_register_part_v1(...)` trong database đã khởi tạo.

Ví dụ đường dẫn tính từ asset root:

```text
parts/shirt/9000/x4/<sha256-64-ký-tự>/sheet.png
parts/weapon/0/9000/x1/<sha256-64-ký-tự>/splash.png
```

Hash nằm trong đường dẫn nên PNG khác nội dung không dùng nhầm cache cũ. `h5_assets.path` là đường dẫn tương đối, không chứa hostname hay blob URL của trình duyệt. Server có thể phục vụ dưới `/assets/` hoặc API của nó; URL công khai cần ghép với asset base URL của server. Khối SQL ghi các đích PNG ngay trong chú thích và UI cũng hiển thị chúng.

SQL nhận JSON được mã hóa UTF-8 hex để không phụ thuộc dấu nháy, backslash hoặc SQL mode. Không phải PNG base64, không ghi bytes ảnh vào MySQL. Metadata frame, rig nhiều mảnh, seat, density và clip idle/walk được lưu trong JSON. Weapon có role splash riêng nếu đã tải WPS. Key weapon có cả phái để không trùng part cùng số của phái khác.

Procedure tự mở transaction, khóa hàng revision, ghi part/assets/item rồi tăng revision và commit. Có lỗi thì ROLLBACK và RESIGNAL: ID part hoặc vật phẩm trùng không để lại part/asset mồ côi. Gọi procedure ngoài transaction khác. Không dùng REPLACE/UPDATE để âm thầm sửa part có sẵn. Chạy lại cùng ID sẽ báo lỗi; cập nhật nội dung cùng ID cần migration/versioning riêng, chưa có UI ghi đè.

ID mới là số nguyên 0–2147483647, không dùng giới hạn Java byte/short. Tên dùng utf8mb4. Gợi ý ID chỉ dựa trên nháp Studio, không kiểm tra database H5 đang chạy; PK/FK trong MySQL là kiểm tra cuối cùng. Dữ liệu HSO và các ID source chỉ để đối chiếu/kế thừa, không tự biến thành alias trong game mới.

**Xem SQL mẫu H5** đăng ký part mẫu và asset tham chiếu, không tự tạo item hay sao lưu item3/item4. JSON nháp cũ vẫn nhập lại được; SQL tạo ra từ lần preview mới luôn nhắm H5.

## Yêu cầu backend H5

Để quy trình chép PNG + chạy SQL thực sự đưa ngoại hình vào game, backend/client cần:

- Đọc h5_parts/h5_assets/h5_item_templates và JSON contract v1; không đọc item3 để dựng part mới.
- Triển khai renderer keys: humanoid-part-v1, weapon-wps-v1, mount-grid-v1, effect-mount-v1, pet-grid-v1, pet-tool-v1. Registry trong database chỉ khai báo giao diện; không tự sinh code renderer.
- Phục vụ PNG ở đường dẫn khai báo và kiểm tra checksum/kích thước khi nạp. SQL không thể kiểm tra file đã chép lên server hay chưa.
- Theo dõi revision để làm mới cache/manifest nhất quán; không truy vấn MySQL cho mỗi tick di chuyển. FPS animation không phải tần số network.
- Khi mặc đồ, kiểm tra quyền sở hữu/điều kiện ở server rồi đồng bộ part key cho client. SQL đăng ký không cấp đồ vào túi hay thêm shop/rơi đồ.

Chỉ số từ item3 được giữ dưới dạng `hso-template-options-v1`, chưa tự chuyển option ID thành công thức chiến đấu game mới. Mẫu không có item nguồn dùng chỉ số trống có nhãn; không bịa chỉ số từ hình ảnh. Những hạn chế của rig nguồn, thiếu WPS, seat chưa xác minh và FX chưa port vẫn tồn tại.

Schema hiện tập trung5 nhóm part mà editor hỗ trợ: quần/áo/vũ khí/thú cưỡi/pet. Map, NPC, tài khoản và nhân vật online sẽ có schema riêng khi dựng base. Không khẳng định chỉ chạy SQL này là có server H5, gameplay hoặc renderer mới.

## Kiểm chứng

- Unit: JSON đầy đủ, frame không đổi, đường dẫn/hash, ID lớn, emoji và SQL literal an toàn.
- Chrome: SQL chỉ hiển thị/sao chép, clipboard và fallback Ctrl+C, ZIP không có .sql, PNG khớp đường dẫn, nhập lại JSON.
- MySQL8.4 thật trong container tạm:40 mẫu gồm2 body part,4 phái vũ khí,22 mount,12 pet; JSON/đường dẫn đối chiếu sau INSERT; duplicate/late item conflict, density/path sai đều rollback; đăng ký part-only; bảng nguồn không đổi.

Kiểm thử MySQL là tùy chọn, không phải phụ thuộc dev/build/runtime. Tạo container MySQL8.4 dùng dữ liệu tạm, không network/port/mount, với tên bắt đầu `studio-h5-copy-sql-check-` và empty root password. Sau đó chạy:

```sh
H5_MYSQL_TEST_CONTAINER=<tên-container-tạm> npm run test:mysql
```

Test chỉ tạo database mang tên studio_h5_sql_test_* trong container chỉ định. Dừng/xóa container tạm sau khi kiểm tra. Không trỏ kiểm thử này vào database đang dùng.
