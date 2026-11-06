# Map viewer

Menu **Map** mở `/maps`, độc lập Character Lab và Thư viện dữ liệu. Đây là viewer chỉ đọc: không sửa tile, không thay spawn, không lưu vào server.

## Dùng

- Tìm tên/ID, chọn một trong91 map có layout.33 mục chỉ có tên vẫn được liệt kê nhưng khóa, không dựng map thay thế.
- Kéo canvas để pan; cuộn hoặc nút+/− để zoom; Vừa khung đưa toàn map vào viewport. Canvas có focus hỗ trợ mũi tên, +/− và0. Touch hỗ trợ kéo và các nút zoom.
- Các lớp: nền, vật thể, lưới24×24, collision, cổng và marker spawn quái. Hover xem world/ô/tile/type; click chọn ô và vật thể theo khung ảnh để xem source, offset và ô chặn.
- Collision overlay đỏ=chặn(type1), xanh=chậm(type2 client). Có thêm ô chặn từ template.Block, nhưng chưa có NPC hoặc trạng thái động của server. Đây không phải toàn bộ luật gameplay.
- Cổng dùng vị trí/tên từ packet map; đích được nối vào cấu hình SQLite chỉ khi tọa độ nguồn khớp duy nhất. Đích chưa khớp được báo chưa xác minh. Marker quái lấy trực tiếp từ maps.mobs, không dùng sprite/AI tự chế. NPC hiện chỉ giữ danh sách tham chiếu packet, không đoán vị trí.
- Khi chuyển menu rồi quay lại, lựa chọn map, camera và lớp hiển thị được giữ trong bộ nhớ. Reload trình duyệt trở về map0.

## Render gốc và giới hạn

Ô24×24 dùng logical units x1, ảnh terrain và vật thể lấy từ PNG x4. Nền tĩnh dùng nhánh LoadMap.paint ở gameTick%14==7: mọi tile được đọc trực tiếp từ ảnh terrain, không rơi vào nhánh nước động. Không sử dụng ảnh nước placeholder để giả lập. Vật thể dùng tọa độ ô×24 +dx/dy, đầy đủ ảnh gốc và thứ tự CRes.quickSort1, kể cả cách xử lý các vật thể cùng hàng.

Chưa hỗ trợ nước/thác động, background/parallax, actor NPC/quái, hiệu ứng đuôi payload và collision runtime. Những phần chưa dựng giữ raw/checksum và được báo trong inspector/JSON. Không khẳng định toàn bộ cảnh/gameplay đã được khôi phục.

Dữ liệu vật thể dùng307 template từ msg_1 server gửi lúc Login_Ok; không dùng table_item mặc định khác phiên bản trong JAR. Đối chiếu nguồn: [báo cáo khảo sát](map-feasibility.md).

## Xuất

- **PNG map:** ảnh toàn bản đồ, luôn gồm nền+vật thể, không kèm overlay/marker. Chọn x1(logical) hoặc x4(kích thước PNG nguồn). Giới hạn64triệu pixel để tránh canvas quá lớn.
- **JSON map:** layout, tileset, template vật thể được sử dụng, collision đã tính, spawn, cổng, tham chiếu NPC, raw nguồn và giới hạn. Đường dẫn PNG còn trỏ tới asset đóng gói của Studio; dùng ZIP nếu cần mang toàn bộ ảnh đi.
- **ZIP Phaser:** `map.json`, PNG x4 cho terrain/các vật thể cần dùng, `runtime.js`, `mapGeometry.js`, `example.js` và README. Không preload tất cả91 map, không có phụ thuộc vào server/JAR/Python. JSON là schema Studio, chưa phải file Tiled.

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
