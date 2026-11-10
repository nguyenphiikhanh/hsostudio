# Map editor

Menu **Map** mở `/maps`, độc lập Character Lab và Thư viện dữ liệu. Map gốc chỉ đọc; có thể chỉnh tile/vật thể trên bản nháp riêng. Chưa sửa spawn/cổng và không lưu vào server. Xem [hướng dẫn nháp và phần còn thiếu](map-editor.md).

## Dùng

- Tìm tên/ID, chọn một trong91 map có layout.33 mục chỉ có tên vẫn được liệt kê nhưng khóa, không dựng map thay thế.
- Kéo canvas để pan; cuộn hoặc nút+/− để zoom; Vừa khung đưa toàn map vào viewport. Canvas có focus hỗ trợ mũi tên, +/− và0. Touch hỗ trợ kéo và các nút zoom.
- Các lớp: nền, vật thể, lưới24×24, collision, cổng và marker spawn quái. Hover xem world/ô/tile/type; click chọn ô và vật thể theo khung ảnh để xem source, offset và ô chặn.
- Collision overlay đỏ=chặn(type1), xanh=chậm(type2 client). Có thêm ô chặn từ template.Block, nhưng chưa có NPC hoặc trạng thái động của server. Đây không phải toàn bộ luật gameplay.
- Cổng dùng vị trí/tên từ packet map; đích được nối vào cấu hình SQLite chỉ khi tọa độ nguồn khớp duy nhất. Đích chưa khớp được báo chưa xác minh. Marker quái lấy trực tiếp từ maps.mobs, không dùng sprite/AI tự chế. NPC hiện chỉ giữ danh sách tham chiếu packet, không đoán vị trí.
- Khi chuyển menu rồi quay lại, lựa chọn map, camera và lớp hiển thị được giữ trong bộ nhớ. Nháp và lịch sử được giữ riêng theo map trong tab; reload trở về map0 và bỏ nháp chưa tải JSON.

## Render gốc và giới hạn

Ô24×24 dùng logical units x1, ảnh terrain và vật thể lấy từ PNG x4. Nền tĩnh dùng nhánh LoadMap.paint ở gameTick%14==7: mọi tile được đọc trực tiếp từ ảnh terrain, không rơi vào nhánh nước động. Không sử dụng ảnh nước placeholder để giả lập. Vật thể dùng tọa độ ô×24 +dx/dy, đầy đủ ảnh gốc và thứ tự CRes.quickSort1, kể cả cách xử lý các vật thể cùng hàng.

Chưa hỗ trợ nước/thác động, background/parallax, actor NPC/quái, hiệu ứng đuôi payload và collision runtime. Những phần chưa dựng giữ raw/checksum và được báo trong inspector/JSON. Không khẳng định toàn bộ cảnh/gameplay đã được khôi phục. Layout đã sửa được ghi rõ studio-draft và có hậu tố edited khi xuất; raw/checksum trong source chỉ tham chiếu bản gốc.

Dữ liệu vật thể dùng307 template từ msg_1 server gửi lúc Login_Ok; không dùng table_item mặc định khác phiên bản trong JAR. Nguồn đối chiếu và cấu trúc dữ liệu được ghi bên dưới.

## Xuất

- **PNG map:** ảnh toàn bản đồ, luôn gồm nền+vật thể, không kèm overlay/marker. Chọn x1(logical) hoặc x4(kích thước PNG nguồn). Giới hạn64triệu pixel để tránh canvas quá lớn.
- **JSON map:** layout đang xem (gốc hoặc nháp), tileset, template vật thể được sử dụng, collision đã tính, spawn, cổng, tham chiếu NPC, raw nguồn và giới hạn. Đường dẫn PNG còn trỏ tới asset đóng gói của Studio; dùng ZIP nếu cần mang toàn bộ ảnh đi.
- **ZIP Phaser:** layout đang xem trong `map.json`, PNG x4 cho terrain/các vật thể cần dùng, `runtime.js`, `mapGeometry.js`, `example.js` và README. Không preload tất cả91 map, không có phụ thuộc vào server/JAR/Python. JSON là schema Studio, chưa phải file Tiled.

API trong ZIP:

```js
import { preloadMap, createMap } from './runtime.js';
// Fetch map.json before creating your scene.
// Scene.preload(): preloadMap(this, '/assets/map-0', mapData);
// Scene.create():
const map = createMap(this, mapData);
map.collisionAt(100, 200); // 0 bình thường;1 chặn/ngoài map;2 chậm
map.container.setPosition(0, 0);
// map.destroy();
```

Runtime chỉ dựng nền/vật thể tĩnh. Trả `terrainLayer` và `objectLayer` để game chủ động đặt actor/depth. Không tự bật physics, pathfinding, AI hay chuyển map khi chạm cổng. Dữ liệu để game xử lý các phần đó vẫn nằm trong map.json.

## Kiểm chứng và phụ thuộc

public/game/maps/index.json liệt kê124 mục; mỗi map ready có JSON riêng. objects.json lưu bảng template và raw msg_1. Unit kiểm tra checksum raw/PNG, tile/object/warp đúng packet, collision, bounds, và so thứ tự vật thể của cả91 map với fixture chạy từ các hàm Java gốc. Chrome kiểm tra mở tất cả91 layout, pan/zoom/layers/inspector, trạng thái khi đổi menu, PNG x4/JSON/ZIP, lỗi HTML/retry và runtime Phaser thật.

Các công cụ khảo sát/nhập và harness Java chỉ chạy tạm bên ngoài project khi phát triển. Build/runtime/test map chỉ dùng JSON, PNG và module JS đã đóng gói; không cần thư mục scripts, Java hay Python.


## Nguồn đối chiếu và cấu trúc dữ liệu

- Server: `Map.send_map_data`, `data/mapnew`, `msg_1`.
- Client Java4.0.3: `ReadMessenge.Login_Ok/changeMap`, `LoadMap.loadmap/load_ItemMap/paint/Block_TileMap_Item`, `ItemMap.paint`, `ObjectData.getImagePartItemMap`, `CRes.quickSort1`.
- SQLite có91 bản ghi maps và124 tên map_data;91 layout mapnew đã đóng gói,33 mục còn lại chỉ có tên. Payload lưới có đúng3+width×height byte; ô24×24 logical.
- Có14 tileset được sử dụng. Các template vật thể mà91 layout tham chiếu đều có PNG x4; bảng msg_1 có307 template, khác bảng table_item mặc định trong JAR.
- Map0 Ngôi Làng Nhỏ là58×30 ô (1392×720 logical),77 vật thể. Kết quả dựng nền/vật thể tĩnh không chứng minh đã khôi phục toàn bộ NPC, hiệu ứng nước hoặc gameplay.
- Chỉ chép nguồn/metadata đã đối chiếu vào public/game/maps. Chạy/build/runtime không cần HSO, JAR, Java, Python hoặc công cụ chuẩn bị dữ liệu.
