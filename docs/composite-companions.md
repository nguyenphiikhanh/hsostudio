# Rig thú cưỡi hiệu ứng và PetTool

## Phạm vi đã triển khai

Studio có 22 ngoại hình thú cưỡi (14 sheet thường +8 DataSkillEff) và12 pet (6 sheet thường +6 PetTool). Tổng34 atlas thú được xuất độc lập trong ZIP v1. Inventory có57/60 vật phẩm có renderer đứng/đi hoặc alias tới renderer đó; ba mục chưa xác minh vẫn bị giữ ngoài bộ chọn: item4 #271, #272, #283.

Rig mới hỗ trợ **idle/walk bốn hướng**. 13 rig sheet đã xác minh trước đây tiếp tục hỗ trợ các chiêu đánh đã mở. Chưa bật đánh cho DataSkillEff/PetTool mới; không coi metadata attack có sẵn là bằng chứng renderer chiến đấu đã hoàn chỉnh. Pet vẫn đặt ở đội hình preview +40 logical units, chưa có AI đi theo.

| Thú cưỡi mới | ID dùng trong Studio/Phaser | id_horse | typeMount |
|---|---|---:|---:|
| Chuột tuyết | effect-69 | 69 |17|
| Voi Ma mút | effect-106 |106|15|
| Cân đẩu vân | effect-111 |111|17|
| Mô tô ma tốc độ | effect-114 |114|20|
| Xe trượt tuyết | effect-115 |115|20|
| Hỏa kì lân | effect-116 |116|20|
| Phượng hoàng lửa | effect-117 |117|22|
| Rồng băng | effect-121 |121|20|

Pet mới: Phượng hoàng băng image21, Zabivaka24, Bóng ma27, Yêu tinh32, Thiên thần36, Sao la39.

`ready` trong inventory nghĩa là có thể preview/equip **trong các trạng thái supportedStates**. Không đồng nghĩa có đầy đủ gameplay, AI, combat hoặc hiệu ứng nước. Phượng hoàng băng có warning riêng: animation đánh gốc index2/tick8 tham chiếu frame64 trong khi rig chỉ có7 frame; dữ liệu lỗi được giữ nguyên, idle/walk được kiểm tra và bật riêng.

## Dùng Studio

Chọn thú/pet trong phần thay bộ phận, chọn Đứng yên hoặc Di chuyển. Bốn khung hướng dùng cùng đồng hồ25FPS. Khung xem tự điều chỉnh tỷ lệ theo bounds của rig nhiều mảnh để không cắt mất cánh/đuôi. Bấm hướng để xem lớn, dùng Tạm dừng/Frame tiếp để kiểm tra.

Vật phẩm x99/vĩnh viễn dùng chung ngoại hình khi mapping đã được xác minh. Ba gói125/223/247 lần lượt nối vào Tuần lộc5, Heo rừng11 và Con lân12. Các gói270/276/280/282/295/300/302 nối tới các rig hiệu ứng tương ứng, không tạo bản sao ảnh.

## Renderer và nguồn

Nguồn là JAR4.0.3 đã khóa checksum và dữ liệu server; mapping, rig và fixture đối chiếu được ghi trong tài liệu này. Không có script nhập dữ liệu trong project; runtime không đọc HSO/JAR/Python. Dữ liệu giải mã nằm trong `src/data/companions.json`.

- `rig.kind=effect-mount`: SmallImage rects, PartFrame x/y/image/flip/top, sequence và metadata raw từ packet type113; typeMount/saddle từ msg_26. `id_horse` không phải prefix hình: request type113 được xác nhận qua MainObject.getEffMatNa và ReadMessenge.loadImageDataCharPart.
- FrameHorse: hướng down0/up7/side14 +Fhorse +phase×21. Idle Fhorse theo A_Stand12tick; đi theo horseMove `[2,2,2,3,3,4,4,4]`, thân body3. Phase hiệu ứng tăng mỗi5tick. Điểm ngồi và xMount/yMount lấy đúng bảng MountTemplate, với clock fMount riêng.
- Các mảnh top/bottom được vẽ theo DataSkillEff.paintBottomHorse/paintTopHorse: layer dưới người và layer trên người/vũ khí, mirror mỗi mảnh ở hướng phải; không flatten ảnh thành một sheet ngựa tự dựng.
- `rig.kind=pet-tool`: DataEffect từ block PET_DATA của msg_26; ảnh icon10200+imageId. Hai nhóm hướng dùng idle timeline0/4 và move1/5 theo indexAction2, flip theo PetTool.setHuong. Độ cao35 khi DataEffect.isFly<=-5, không dùng độ cao50 của PetFly sheet thường.
- PNG x4 giữ nguyên; crop/offset là logical x1, nhân density khi đọc texture. Không dùng UV của x1 đoán bố cục x4.
- rawHex/rawSha256, phần bytes client không đọc và các class checksum được giữ để kiểm tra nguồn và nghiên cứu tiếp. Không tự gán nghĩa các phần bytes dư.

Các bóng/hiệu ứng phụ riêng, nước, chiến đấu, AI và chuyển động trong thế giới chưa đầy đủ; chỉ các mảnh bóng đã nằm trong rig ảnh gốc được vẽ cùng rig.

## ZIP v1 và Phaser

Giữ nguyên các folder part cơ thể và API cũ. Mỗi thú có `sheet.png`, `atlas.json`, `companion.json` trong `mounts/<id>/` hoặc `pets/<id>/`. Atlas của rig nhiều mảnh cắt theo danh sách rects, không dùng grid. `rig.frames` tham chiếu các rect này để dựng từng frame/hướng.

```js
character.mount('effect-111'); // Cân đẩu vân
character.setPet('24');       // Zabivaka
character.setState('walk', 'right');
character.equipCompanionItem('mount', 276); // gói x99 cùng ngoại hình
character.equipCompanionItem('pet', 4626);  // Phượng hoàng băng, idle/walk
character.mount(null);
character.setPet(null);
```

Inventory có `companionId` rõ ràng vì typeMount17 có thể là Chuột tuyết hoặc Cân đẩu vân; không thể dùng typeId làm khóa ngoại hình duy nhất cho rig hiệu ứng. Runtime vẫn đọc inventory cũ thiếu companionId bằng fallback trước đây.

Runtime tái sử dụng pool sprite cho từng mảnh, đổi texture frame/position/flip/depth và ẩn mảnh không được dùng; không tạo sprite vô hạn mỗi tick. Khi thay/bỏ thú, các sprite của rig trước được hủy qua rebuild. `reindex-library.mjs` hỗ trợ cả grid và composite, kiểm tra clip idle/walk và rect/part bounds trước khi ghi atlas. Gói v1 cũ vẫn nạp được.

## Thay ảnh HD

Copy folder thú sang ID mới, đổi id/label/provenance trong companion.json. Thay PNG và cập nhật `asset.width/height/density`, sửa `rig.rects` theo layout ảnh nếu đổi bố cục; các PartFrame vẫn gắn rect qua index `image`. Offset, seat và kích thước rect logical giữ cùng ý nghĩa x1. Chạy công cụ reindex có sẵn trong ZIP để sinh atlas mới. Không thay rig theo tên file hoặc nhân tọa độ pixel tùy ý.

## Kiểm chứng

Unit kiểm tra checksum, mọi crop/frame idle/walk trong toàn bộ chu kỳ bốn hướng, phase21, clock5tick, flip, seat, layer và dữ liệu lỗi PetTool. Chrome kiểm tra từng rig mới trong preview, export tư thế nhiều mảnh, ZIP và56 tổ hợp rig ×hướng trong Phaser thực tế; có kiểm tra pool không tăng theo số frame.

## Sửa lỗi thứ tự lớp của rig hiệu ứng

Đã đối chiếu lại cả bytecode `FrameEff(mVector,mVector)` trong JAR4.0.3: tham số đầu tiên được gán cho `listPartTop`, tham số thứ hai cho `listPartBottom`. `DataSkillEff.loadData` đưa mảnh `onTop == 0` vào tham số đầu tiên. Vì vậy **onTop0 vẽ sau người/vũ khí; onTop khác0 vẽ trước người/vũ khí**. Studio trước đây đã diễn giải ngược theo tên trường; cả preview và runtime ZIP nay dùng đúng constructor gốc. Thứ tự trong từng pass vẫn giữ nguyên theo packet. PetTool vẽ toàn bộ mảnh theo thứ tự nguồn, không chia pass thú cưỡi.

Một lỗi đi kèm được sửa: số mảnh sau khi bung rig không được làm thay đổi depth của thân/vũ khí. Lớp dưới thú cũng phải nằm dưới vũ khí sau lưng người, theo `MainObject.paintPlayer`. Depth nay được cố định trước khi bung rig, kể cả khi người dùng thay thứ tự chọn pet/thú hoặc số mảnh thay đổi giữa các frame.

`tests/fixtures/horse-client-draws.json` lưu SHA256 của lệnh vẽ cho toàn bộ651 frame của8 rig, cả hướng thường và mirror. Fixture được lấy bằng cách chạy nguyên các hàm loadData/paintBottomHorse/paintTopHorse và constructor FrameEff trích từ client trong harness Java tạm thời; `null` đánh dấu lúc vẽ người giữa hai pass. Kiểm thử so sánh crop, vị trí tương đối, flip và thứ tự hai pass trong mọi tick của chu kỳ đứng/đi bốn hướng. Fixture giữ checksum JAR/class/raw packet để xác định nguồn. Project chỉ đọc fixture JSON khi test, không cần Java, Python hoặc thư mục scripts.

## Chuột tuyết và Voi Ma mút: giới hạn ghế ngồi

Hai rig vẫn giữ nguyên PNG, frame, offset và tọa độ người cưỡi từ nguồn. Người dùng yêu cầu chỉ dùng tọa độ gốc; không áp dụng căn chỉnh thủ công hoặc suy ra điểm ngồi bằng mắt.

- Chuột tuyết (`effect-69`): `UseItem.use_item_mount` của server đang gán typeMount17, trùng loại Cân đẩu vân. Tọa độ được chép đúng từ hàng17 của msg_26, nhưng chưa có bằng chứng xác nhận hàng này phù hợp với yên trong PNG113_69. Không tự thay sang type14 chỉ vì hàng đó đứng gần trong bảng.
- Voi Ma mút (`effect-106`): dùng typeMount15 từ server và hàng15 của msg_26. Chưa xác nhận điểm ngồi này phù hợp với yên trong PNG113_106. Việc khớp bảng nguồn không chứng minh người cưỡi sẽ ngồi đúng về mặt hình ảnh.

Đã chạy lại các nhánh đứng/đi của `MainObject.updateActionPerson`, `updateMount`, `getFrameHorse` trích từ JAR trong harness tạm thời. Mỗi rig được đối chiếu360tick ×4hướng ×2trạng thái: frame thú, bodyFrame, dyMount và xMount/yMount khớp renderer Studio. Vì vậy chưa có căn cứ đổi nhịp/offset để chữa lệch yên. Kiểm chứng này giữ trong fixture JSON; project không cần Java khi chạy test hoặc build.

Cả hai có `riderBinding.status = "unverified"`, `policy = "preserve-original"`, lý do và nguồn tọa độ trong companion.json của ZIP. Bộ chọn ghi “ghế chưa xác minh”, preview có cảnh báo. Trạng thái part `ready` chỉ nói ảnh/clip có thể render; **không xác nhận ghế ngồi của hai rig này đã đúng**. Để gỡ cảnh báo cần nguồn bổ sung xác nhận binding người cưỡi (client/data tương ứng hoặc bản ghi client gốc để đối chiếu), không chỉ một crop/frame hợp lệ.


## Ba vật phẩm còn thiếu mapping

- **Trâu rừng item4 #271 / x99 #272:** chưa có case xác minh trong `UseItem.use_item_mount`. Ảnh candidate icon/x4/10714.png chỉ16×16px, không đủ chứng minh là sheet thú; không tự gán type14 theo thứ tự ID.
- **Mô tô item4 #283:** chưa có handler xác nhận dùng cùng ngoại hình với item279. Tên trùng không phải bằng chứng mapping.

Các mục này vẫn cần client/packet hoặc mapping phù hợp trước khi bật preview/equip/export; không tạo art thay thế. Bảng alias, raw packet và checksum hiện nằm trong `src/data/companions.json`.
