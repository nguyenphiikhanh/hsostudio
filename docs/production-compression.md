# Build production với gzip và Brotli

Chạy `npm run build` như trước. Plugin `build/compression.js` dùng Node zlib, không thêm dependency, tự tạo file `.gz` và `.br` cạnh file gốc trong `dist/`, gồm HTML, JS, CSS, JSON, SVG, text, WASM và SQLite. Không đổi URL trong ứng dụng; trình duyệt vẫn yêu cầu file gốc và giải nén theo Content-Encoding.

Chỉ xét file từ256byte và chỉ giữ mỗi bản nén nếu nhỏ hơn file gốc. PNG và các định dạng đã nén không bị nén lại. Gzip level9, Brotli quality9; tối đa4 file xử lý đồng thời. Build log ghi tổng dung lượng trước/sau của nhóm tài nguyên xét nén, không phải toàn bộ thư viện PNG. File gốc giữ nguyên, sidecar giữ mtime gốc. Public/source không bị viết lại.

## Kiểm tra local

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
curl -I -H 'Accept-Encoding: br' http://127.0.0.1:4173/game/catalog.sqlite
curl -I -H 'Accept-Encoding: gzip' http://127.0.0.1:4173/game/catalog.sqlite
```

Preview ưu tiên Brotli khi có cùng q-value, hỗ trợ lựa chọn gzip và fallback file gốc. Header của bản nén có `Content-Encoding: br` hoặc `gzip`, `Vary: Accept-Encoding`, Content-Type của file gốc và Content-Length của bản nén. Middleware nén nằm trước middleware game assets để SQLite/JSON được phục vụ đúng; PNG vẫn đi theo đường cũ. GET/HEAD được hỗ trợ; Range để server gốc xử lý. Preview dùng cache no-cache để dễ kiểm tra.

`npm run test:compression` kiểm tra giải nén khớp bytes, MIME, header, q-value, HEAD, base path, bỏ qua PNG, file không đáng nén và đường dẫn/symlink ra ngoài thư mục build. Kiểm thử HTTP cần quyền mở cổng loopback.

Vite preview chỉ để kiểm tra local, không phải production server ([Vite deployment](https://vite.dev/guide/static-deploy.html)).

## Đưa lên production

Upload **toàn bộ dist/**, gồm file gốc, `.gz`, `.br` và `game/`. Không chỉ upload các file nén, không đổi đường dẫn SQLite/WASM và không rewrite asset bị thiếu thành index.html. Host/CDN phải hỗ trợ phục vụ sidecar hoặc tự nén HTTP; việc có file `.br` trên đĩa chưa đảm bảo client nhận bản Brotli.

Chọn một cấu hình mẫu, đều dành cho deploy ở root `/`:

- **Caddy:** `deploy/Caddyfile` có `file_server { precompressed br gzip }`; dùng được cả hai định dạng. Chạy `caddy run --config deploy/Caddyfile` từ thư mục repo để thử cổng8080; đổi site address và root khi đưa lên server. Xem [Caddy file_server](https://caddyserver.com/docs/caddyfile/directives/file_server).
- **Nginx:** chép `deploy/nginx.conf` vào cấu hình http/conf.d và chỉnh root `/srv/studio/dist`. Bật gzip_static; cần module gzip_static của bản Nginx. Muốn Brotli, cài/load module ngx_brotli static rồi bỏ comment `brotli_static on;`. Không bật directive Brotli nếu module chưa có. Chạy `nginx -t` trước khi reload. Xem [gzip_static](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html), [ngx_brotli](https://github.com/google/ngx_brotli).

Các mẫu cache asset có hash trong `/assets/` một năm/immutable. HTML và `/game/` dùng no-cache vì dữ liệu game hiện chưa có URL version/hash đồng bộ để cache lâu an toàn. No-cache cho phép cache nhưng yêu cầu revalidation; không đồng nghĩa no-store. Khi deploy dưới `/studio/`, build với `npm run build -- --base=/studio/` và điều chỉnh mount/root/fallback của server tương ứng; không dùng nguyên mẫu root `/`.

Mở DevTools → Network và kiểm tra Content-Encoding/Transferred cho JS, WASM và catalog.sqlite. Nén giảm dung lượng truyền; thời gian thực tế còn phụ thuộc mạng, cache và thời gian parse/khởi tạo ứng dụng. Các cấu hình Caddy/Nginx là mẫu tích hợp, không tự cài đặt hay thay cấu hình server đang chạy.
