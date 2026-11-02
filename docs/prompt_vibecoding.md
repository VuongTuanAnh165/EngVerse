🎯 MỤC TIÊU ĐỢT NÀY: Thực thi Pha 1 — Task 1.1, 1.2, 1.3, 1.8, 1.9 (Nâng cấp Schema, Roleplay PlotTwist Engine & Word Alchemy UI)

Hãy thực hiện theo đúng quy trình 4 bước nghiêm ngặt dưới đây:

BƯỚC 1 — ĐỌC TÀI LIỆU & KHẢO SÁT CODEBASE (INSPECT FIRST):
1. Đọc `.antigravity/rules.md` để nắm 6 kỷ luật kiến trúc (1-Doc-Per-User tại `users/{uid}`, không tạo subcollection, không dùng `fs.readFileSync`, Sliding Window 4 lượt, timeout 6s + fallback OpenRouter).
2. Đọc `docs/roadmap_stage_depth_and_endgame.md`: Tra cứu các Task trong `MỤC TIÊU ĐỢT NÀY` tại bảng Lộ trình (Mục VI), sau đó đọc kỹ toàn bộ đặc tả kỹ thuật, TypeScript Interfaces, công thức và luồng hoạt động tương ứng tại Mục III, IV, V của tài liệu đó.
3. Quét và đọc các file code hiện tại trong `app/types/`, `app/stores/`, `app/components/`, `app/pages/` và `server/api/` có liên quan trực tiếp đến Task trước khi viết code để giữ đúng naming convention và không làm gãy tính năng đang chạy.

BƯỚC 2 — RÀNG BUỘC KỸ THUẬT BẮT BUỘC (STRICT CONSTRAINTS):
- Tương thích ngược (Backward Compatibility): Mọi trường mới thêm vào `VocabItem` (`collocations`, `realWorldPhrase`, `synonyms`), `GrammarItem` (`functionalCategory`), `AiRoleplayMission` (`plotTwist`), hoặc `UserProfile` (`dailyChallenge`, `bossRush`, `freeSimulator`) BẮT BUỘC phải là optional (`?`) hoặc có giá trị fallback mặc định để game vẫn chạy mượt với các file JSON chưa kịp nâng cấp đủ trường.
- Đồng bộ Full-Stack (UI + Store + Server API): Nếu Task có tác động đến logic (như `plotTwist`, tăng `maxTurns`, tính điểm, lưu tiến trình), phải cập nhật đồng bộ từ Type -> Pinia Store -> Vue Component -> Server API (`server/api/**`), không được chỉ sửa mỗi UI.
- Chuẩn mực Code: Dùng `<script setup lang="ts">`, Vue 3.5 (`useTemplateRef`, `onUnmounted`, `onWatcherCleanup`), TypeScript Strict Mode (0 `any`). Viết code hoàn chỉnh 100%, tuyệt đối KHÔNG dùng `// TODO` hay `// ...rest of code`.

BƯỚC 3 — TRIỂN KHAI CODE (IMPLEMENTATION):
- Tiến hành tạo mới hoặc cập nhật từng file theo đúng thiết kế trong `docs/roadmap_stage_depth_and_endgame.md`.

BƯỚC 4 — TỰ KIỂM ĐỊNH (SELF-VERIFICATION):
- Chạy kiểm tra lỗi biên dịch TypeScript / linter trên các file vừa sửa.
- Nếu Task có chỉnh sửa file `.json` trong `public/data/**`, hãy chạy lệnh kiểm tra `JSON.parse` để đảm bảo không sót dấu phẩy hay lỗi cú pháp.
- Tóm tắt ngắn gọn các thay đổi đã thực hiện theo từng Task.