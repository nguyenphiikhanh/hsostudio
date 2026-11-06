# Thú cưỡi và pet trong thư viện v1

Đã khôi phục 14 ngoại hình thú cưỡi sheet thường (20 vật phẩm/alias) và 6 pet cơ bản. PNG gốc ưu tiên x4, không vẽ lại hoặc lấy tên file đoán loại thú. Các bản x99/vĩnh viễn chỉ dùng chung rig khi đã xác minh mapping. Inventory có 48 vật phẩm mount và 12 template vật phẩm pet; 34 mục chưa hỗ trợ được ghi rõ, không biến thành thiết kế giả.

## Dùng Studio

Trong **Thay bộ phận trực tiếp trên nhân vật**, chọn **Thú cưỡi → Ngựa nâu** và **Thú cưng → Cú**. Chuyển Đứng yên/Di chuyển; chọn một trong bốn hướng, tạm dừng hoặc xem từng frame. Chọn Không dùng để bỏ từng thú. Nhân vật mẫu ban đầu không tự chọn thú.

Khi có thú, đồng hồ renderer chạy 25 FPS. Nhịp thân không cưỡi vẫn giữ tốc độ preview đã chọn. Người cưỡi dùng nhịp/body frame và điểm ngồi gốc; quần bị ẩn theo nhánh mounted của client. 13 rig sheet thường (type1–13) hỗ trợ chiêu đánh #0–#8, #17, #19, #20 khi đã chọn vũ khí thường; các chiêu khác bị khóa. Ngựa nâu type0 bị client cấm đánh; rig id_horse/DataSkillEff chưa được mở. Pet thuộc kiểu vừa bay vừa đi (Cú) có idle đã hạ cánh; khi di chuyển dùng pose bay cao50 theo client. Pet bay hẳn (Dơi/Rồng lửa) giữ độ cao50.

Vị trí pet +40 units bên cạnh nhân vật là **bố trí để xem**; hướng lấy từ nút preview. Chưa port state machine đi theo, lượn ngẫu nhiên, tìm đường, chiến đấu và tương tác nước. Không gọi vị trí này là offset theo chủ gốc. Demo arena “Chơi thử H5” hiện chưa dùng rig mount/pet và bị khóa khi chúng được chọn; preview Studio và runtime Phaser trong ZIP hỗ trợ hai rig này.

## Nguồn đối chiếu

JAR Java4.0.3 SHA256: `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`. Phân tích tĩnh, không chạy/đăng nhập client. Hash từng class và packet được lưu trong `src/data/companions.json`.

- Server `UseItem.use_item_mount`: item4 ID62–66 → type0–4. Các trường hợp khác được đọc theo switch; id_horse/DataSkillEff tách riêng, không đưa vào rig sheet thường.
- Server `Pet.get_pet`: item3 ID2944 → type0, icon/imageId3, nframe3. Vì thế Cú dùng `10203`, **không phải** `10200` (Dơi).
- Server `MapService` gửi pet type, icon và nframe; `Pet.createPet` chọn kiểu bay/đi qua `mTypemove`.
- `ReadMessenge.catalogyMonster` đọc packet `msg_26`: FRAME_VE_TRUOC, DY_CHAR_STAND/MOVE, dx/dy, FRAME_MOVE_LR/DOWN/UP và kiểu di chuyển pet. Đã giữ các bảng có sẵn, không tự chọn điểm ngồi.
- `ObjectData.getImageMount`: imageId+10700. `FrameImage.drawFrameNew` cắt **column-major**, 3 cột ×5 hàng, anchor HCENTER|BOTTOM; phải dùng mirror của client.
- `MainObject.updateMount`: idle side0/1, down5/6, up10/11 theo A_Stand; move lấy timeline từ packet, thân dùng ArrMount/body3, điểm ngồi thay theo frame/hướng.
- `MainObject.paint`: bỏ lớp quần (part type0), thay bằng mount ở lớp sau hoặc trước theo FRAME_VE_TRUOC; các lớp thân dịch lên dyMount.
- `ObjectData.getImagePet`: imageId+10200. PetWalk/PetFly dùng sheet hai cột, ba hàng; Pet.setAnim chọn mWoftAnimFrame/mBat/mOwl. PetFly hạ cánh ép crop0.

Ảnh thú nằm trong nhóm `icon` vì server dùng chung bộ nạp ảnh theo numeric ID. Asset trong danh mục phải có kích thước x1 đối chiếu; PNG x2–x4 chỉ dùng khi đúng tỷ lệ và chia hết theo grid. Hash ảnh được lưu để kiểm tra.

## ZIP và Phaser

Vẫn là version1, giữ nguyên `parts/<slot>/<id>/` và 415 part cơ thể. Thêm:

```text
mounts/0/{sheet.png,atlas.json,companion.json}
pets/3/{sheet.png,atlas.json,companion.json}
companions.inventory.json
companionPose.js
```

`library.json` bổ sung `companions`, `companionAtlases`, `companionInventory`. `character.json.companions` lưu lựa chọn, ví dụ `{"mount":"0","pet":"3"}`. Manifest và outfit cũ không có các trường này vẫn được runtime mới đọc. `preloadLibrary` nạp các atlas thú đi kèm; mỗi atlas riêng theo thiết kế.

```js
character.mount('0');                    // Ngựa nâu
character.setPet('3');                   // Cú
character.setState('walk', 'right');
character.equipCompanionItem('mount', 70); // alias gói ngựa nâu
character.equipCompanionItem('pet', 2944);
character.mount(null);
character.setPet(null);
```

ID không tồn tại/chưa ready sẽ bị từ chối trước khi thay lựa chọn. Quần hiện lại khi bỏ thú cưỡi. State attack khi cưỡi chỉ được nhận nếu rig có mountedAttack.status=ready đã xác minh và animations.states.attack là clientBasic/clientSkill đã xác minh và skillId thuộc danh sách được phép; còn lại bị từ chối. Runtime này không bao gồm logic cưỡi/chiến đấu/collider của game HSO.

## Thay PNG HD hoặc thêm thiết kế

Copy thư mục thú sang ID riêng; sửa `id` trong companion.json trùng tên thư mục và đổi provenance/source thành custom-design cho thiết kế mới. Thay PNG; cập nhật `asset.width/height/density` và frameWidth/frameHeight nếu cần. frameWidth/frameHeight, offsets và điểm ngồi là logical x1 units; tăng density và kích thước pixel giữ nguyên kích thước trong thế giới. Grid hiện hỗ trợ layout sheet gốc, không hỗ trợ đóng sheet tự do.

Chạy `node reindex-library.mjs` trong gói giải nén. Công cụ đọc lại các folder mount/pet, kiểm tra rig/crop/kích thước PNG và sinh lại atlas/manifest; lỗi thì không ghi các atlas đã xếp hàng. Không sửa atlas cơ thể hoặc ID vật phẩm để nâng độ phân giải. Bản runtime hoàn toàn dùng file tĩnh, không cần server HSO, Java hoặc Python.

## Nhập lại reference (chỉ người bảo trì)

`scripts/import-companions.mjs` là công cụ Node chạy thủ công, không nằm trong dev/build/runtime. Công cụ cần dữ liệu server, JAR đã khóa checksum ở root repo và thư mục decompile tĩnh của cùng JAR:

```sh
node scripts/import-companions.mjs /path/to/hso /path/to/decompiled-client403
```

Nguồn mới được nhập vào metadata trong repo, dùng ảnh đã đóng gói. Không cần giữ các nguồn bên ngoài để chạy Studio. Rig effect id_horse (Cân đẩu vân, xe/phượng hoàng/rồng...) và PetTool được ghi trong inventory, chưa có renderer. Không coi `id_horse` là tiền tố file ảnh.


## Các chiêu đánh trên thú dạng sheet thường

Chọn **thú cưỡi được phép → vũ khí thường đúng phái → Tấn công → chọn chiêu đánh**. Các rig hỗ trợ: Ngựa trắng, Ngựa chiến giáp, Ngựa xích thố, Ngựa đen, Tuần lộc, Sói xám, Sói gió tuyết, Sói bão lửa, Sói bóng ma, Sư tử, Heo rừng, Con lân, Ngựa Skeleton. Có đủ bốn phái và bốn hướng, play/pause/step. Khi vào trạng thái đánh, Studio chụp phase thú ở idle hoặc walk; mỗi hướng dùng cùng phase đó để so sánh. Trong cả đòn, frame, offsets và dyMount giữ nguyên. Thân và WPS vẫn chạy timeline client của chiêu được chọn (25FPS); không bị ép trở lại thân ngồi body0/3.

Bằng chứng:

- Client `Player.setDelaySkill` kiểm tra typeMount==0 và trả false; đây là vị trí xác nhận chặn Ngựa nâu. Mô tả item4 cũng ghi cấm đánh. Chưa thấy điều kiện tương ứng trong hàm đánh server nên không khẳng định server đã enforce hạn chế này.
- Client `MainObject.updateMount` chỉ cập nhật thú khi Action0/1; Action2 giữ frameMount, xMount, yMount, dyMount từ trạng thái trước.
- `MainObject` nhánh Action2 gọi SplashSkill.update, thân4/5 và weapon_frame4–7. `paintWeapon` trừ dyMount cho cả vũ khí thường và WPS.
- Quần tiếp tục ẩn khi cưỡi; mount trước/sau người phụ thuộc FRAME_VE_TRUOC của frame được giữ.

Xuất thư viện **trong lúc đang xem chiêu đánh đã xác minh** để animations.json mang đúng clip clientBasic hoặc clientSkill. Sau khi preload:

```js
character.mount('1');
character.setState('idle', 'right');
character.setState('attack', 'right');
// Gọi lại attack để phát lại; idle/walk để rời tư thế kết thúc.
```

Runtime giữ phase thú tại lúc chuyển idle/walk sang attack và hỗ trợ manifest v1 mới này. Như trước, thư viện part chỉ xuất **thân + thú**, chưa export/equip texture vũ khí hoặc hiệu ứng kỹ năng: WPS được xem đầy đủ trong Studio và bản xuất tư thế tĩnh. Không mô phỏng sát thương, cooldown, AI pet; Các chiêu đánh #1–#8/#17/#19/#20 đã mở; nội tại/buff chưa nằm trong nhóm preview đòn đánh. Gói xuất khi đang ở chuỗi thử nghiệm không đủ điều kiện đánh khi cưỡi và sẽ bị từ chối rõ ràng.

Mở rộng type1–13 dùng cùng nhánh updateMount/paintWeapon của client, không gán animation mới. Kiểm thử đối chiếu từng rig ở cả bốn hướng, bốn phái, entry idle/walk và các phase 0/4/8/11; giữ nguyên frame/seat/layer thú trong cả đòn. Chrome kiểm tra 13 rig, ZIP Phaser kiểm tra 52 trường hợp rig × hướng. Không mở rộng chính sách này sang id_horse/rig hiệu ứng.

### Mở chiêu #1 trở lên

Các rig type1–13 cho phép #0–#8, #17, #19, #20; policy này có trong metadata và runtime. Không chỉ bỏ khóa giao diện: clip export phải mang clientBasic/clientSkill, experimental=false và skillId được phép. Client body/WPS theo SplashSkill của từng phái; giữ nguyên rig/frame/seat lúc bắt đầu chiêu.

Khung hiệu ứng #1–#4 dùng các bộ dựng chính đã khôi phục. EffectSkill.set_New_Effect khởi tạo caster ở x/y thế giới, y-hOne/2, không trừ dyMount như paintWeapon; vì vậy không tự dịch toàn bộ FX theo người cưỡi. Mục tiêu vẫn là fixture cao40. Các phần hạt/tụ lực/nước/âm thanh còn thiếu như phạm vi đã ghi cho từng chiêu.

Nhóm #5–#8/#17/#19/#20 khi cưỡi chỉ hiển thị thân/WPS; ẩn bộ preview hiệu ứng tổng quát do layout/đường bay/hạt hiện chưa được đối chiếu đầy đủ. Không gọi layout minh họa là nguyên bản. Thư viện part tiếp tục chỉ xuất thân/thú, không equip vũ khí hoặc phát FX.

Đã sửa hai trường hợp trong mapping cũ: plash0 của các chiêu tấn công cấp cao vẫn phát chuỗi min4, không phải một frame đứng; plash4 của Sát thủ dùng weapon_frame8/9 ở cuối đòn, vượt số frame WPS nên client không vẽ vũ khí tại hai tick này. Renderer ẩn vũ khí thay vì giữ giả frame7 hoặc truy cập frame không tồn tại.
