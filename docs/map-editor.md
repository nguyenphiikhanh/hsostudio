# Map editor: tile và vật thể trên nháp

Đã triển khai tại `/maps`. Mốc này cho sửa tile và vật thể trên bản nháp tách riêng từ91 layout gốc. Không ghi file nguồn, SQLite hay server HSO.

## Công cụ

| Công cụ | Thao tác |
|---|---|
| Chọn/Pan | Click chọn ô/vật thể theo khung ảnh; kéo để pan |
| Bút tile | Chọn tile trong palette, kéo vẽ; nội suy ô để nét không bị hở khi kéo nhanh |
| Tẩy tile | Đặt về tile0. Ô0 không có ảnh và bị chặn theo quy tắc client |
| Tô vùng | Flood fill4hướng trên các ô cùng tile ID; một bước Undo |
| Hút tile | Click lấy tile đang dùng rồi trở về bút |
| Đặt vật thể | Chọn template/PNG gốc, click ô neo trong map |
| Kéo vật thể | Kéo theo lưới24đơn vị; giữ nguyên offset và ảnh source |
| Nhân bản | Tạo ID mới cùng ô, chọn bản sao rồi tự chuyển sang Kéo vật thể |
| Xóa | Xóa vật thể đang chọn; có Undo |
| Khôi phục gốc | Phục hồi tile/vật thể gốc thành một lệnh có thể Undo |

Palette tile chỉ lấy các rectangle24×24 đầy đủ của tileset hiện tại. Palette vật thể giữ307 template;6 template thiếu PNG bị khóa. Không đặt tên đoán cho template, không tạo ảnh thay thế. Chỉ dùng PNG/offset/Block hiện có; vị trí mới do người dùng chỉnh là thiết kế Studio, không gọi là dữ liệu HSO nguyên bản.

Khi kéo, ưu tiên vật thể đang chọn nếu điểm bấm nằm trong khung của nó để có thể di chuyển bản sao đang chồng lên bản gốc. Chọn/Pan dùng thứ tự hiển thị để chọn vật thể trên cùng. Ô neo mới/chỉnh sửa phải trong map; object gốc có ô neo ngoài biên vẫn được giữ nguyên khi không chỉnh. Ảnh có thể vượt biên do offset gốc và sẽ bị crop theo canvas map.

## Undo/Redo và camera

Một nét hoặc một lần kéo là một lệnh; click không làm thay đổi không tạo lịch sử. Esc, pointer cancel hoặc rời trang khi còn kéo hủy toàn bộ thao tác chưa kết thúc. Undo/Redo giữ100lệnh/map; sửa mới cắt nhánh Redo. Reset và nhập nháp đều có Undo.

Khi canvas có focus: Ctrl/Cmd+Z Undo, Shift+Z hoặc Ctrl/Cmd+Y Redo; Delete/Backspace xóa vật thể chọn; Ctrl/Cmd+S tải nháp. Space hoặc chuột giữa pan từ mọi công cụ; cuộn/+− zoom,0 vừa khung. Chỉnh layout không reset camera. Trở về map khác giữ nháp/lịch sử, công cụ về Chọn/Pan để tránh sửa nhầm.

Collision tự tính lại từ tileType và template.Block sau mọi chỉnh sửa/Undo. Xóa một trong các vật thể chồng nhau không xóa ô chặn của vật thể còn lại. Chưa có layer collision override thủ công.

## Lưu và nhập nháp

**Nháp hiện chỉ lưu trong bộ nhớ tab.** Đổi menu/map giữ được nháp; đóng/reload trình duyệt sẽ mất nếu chưa tải file.

- Tải nháp JSON: file `map-<id>-<name>.map-draft.json`, schema `hso-map-draft`, version1. File giữ trạng thái tiles/objects cuối cùng, không chứa toàn bộ lịch sử Undo hoặc PNG.
- Nhập nháp JSON: mở đúng map rồi chọn file. Map ID, checksum packet gốc/bảng vật thể/PNG terrain, kích thước và tileset phải khớp. Không dùng JSON layout xuất cho Phaser thay cho file nháp.
- Chỉ nhận tiles/objects với tile ID trong tileset, ID object không trùng, template có PNG và ô neo chỉnh sửa hợp lệ. Không âm thầm nhập rotation/scale, collision, spawn hoặc fields chưa hỗ trợ. Giới hạn8MB/file và5000object/nháp.
- Nạp PNG mới cần dùng trước khi áp dụng; nếu thiếu ảnh, sai nguồn, sai cấu trúc hoặc map bị đổi trong lúc nhập, giữ nguyên layout/lịch sử cũ. Nhập thành công là một bước Undo.

## Xuất PNG/JSON/Phaser

Tất cả nút xuất map dùng layout đang xem, gồm các chỉnh sửa chưa tải nháp JSON. Collision được tính lại, template/PNG mới thêm được đưa đủ vào ZIP. Ảnh source x4 không bị thay đổi.

Bản đã sửa có hậu tố `-edited`, `editInfo.modified=true`, `rendering.layout='studio-draft'`. `source.rawHex` và checksum vẫn chỉ mô tả packet gốc để đối chiếu, không phải binary của bản đã chỉnh. PNG không kèm lưới/marker/overlay. PNG x1/x4 giữ cùng kích thước logical của map. ZIP đã kiểm tra nạp trong Phaser thật, đọc vị trí và collision đã sửa.

## Các nhiệm vụ tiếp theo chưa triển khai

1. **Collision editor riêng:** bút0/1/2, layer override và quy tắc ghép với Block/NPC/runtime; hiện chỉ tự suy từ tile/vật thể.
2. **Spawn/cổng/NPC:** chỉnh tọa độ/loại/đích, liên kết các map và giải mã đúng vị trí NPC. Hiện vẫn là metadata/marker nguồn, chưa sửa hoặc phát actor/AI.
3. **Thiết kế map mới:** tạo ID, resize, nhiều tileset/layer, import PNG/tileset/vật thể mới và chỉnh template/pivot/Block. Hiện chỉ dùng layout và tài nguyên đã đóng gói.
4. **Công cụ vùng:** chọn rectangle, copy/paste tile/object nhóm, brush nhiều ô, autotile, layer tùy chọn, điều khiển z-order/tách nhóm và preview ghost trước khi đặt.
5. **Preview gameplay/hiệu ứng:** play-test nhân vật/collision/pathfinding, background/parallax và các hiệu ứng chưa giải mã.
6. **Project persistence:** autosave/IndexedDB, project workspace/file-system, khôi phục lịch sử sau reload, migration nháp khi source thay đổi. Hiện lưu bằng file JSON tải/nhập thủ công.

Chưa có encoder xuất ngược `mapnew` cho HSO/server hoặc format Tiled. Đây không phải yêu cầu của ZIP Phaser hiện tại.

## Kiểm chứng

Unit kiểm tra gộp stroke, fill, hủy, no-op, Undo/Redo/nhánh mới, reset, source bất biến, collision object chồng nhau, import sai nguồn/cấu trúc và giới hạn lịch sử. Thứ tự vật thể dùng phiên bản iterative của thuật toán CRes gốc, kiểm tra cùng fixture Java cho cả91 map để tránh tràn stack với nháp lớn.

Chrome kiểm tra tương tác bút/tẩy/fill/eyedrop, Space pan không vẽ nhầm, hủy bằng Esc, phím tắt Undo/Redo, đặt/kéo/nhân bản/xóa, nhớ nháp khi đổi map/menu, reload+nhập file, từ chối sai source/thiếu PNG, PNG đã sửa và ZIP Phaser thật với layout/collision mới. Không phụ thuộc scripts, hso, Java hoặc Python khi chạy/build.

## Nước và thác

Hai checkbox Nước động / Thác động cạnh các lớp hiển thị chạy theo nhịp client 4.0.3, mặc định tắt. Thử map #66 Thác reo hoặc #51 Cổng thiên đàng. Lựa chọn áp dụng cho JSON/ZIP Phaser; PNG chụp khung tick 0. Runtime có `setAnimations({water:true,waterfall:true})`. Không đổi collision hoặc dữ liệu gốc.
