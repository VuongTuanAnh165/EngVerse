[SPRINT HIỆN TẠI]: SPRINT 1
[TASK HIỆN TẠI]: Mục 1

Hãy đọc file `@docs/ke_hoach.md` và `.antigravity/rules.md`, sau đó chỉ tập trung thực thi duy nhất **[TASK HIỆN TẠI]** nằm trong phần "Công việc chi tiết phải làm" của **[SPRINT HIỆN TẠI]**.

Thực hiện tuần tự và nghiêm ngặt theo 5 bước sau:

1. **Xác định Phạm vi & Ánh xạ Kiến trúc Nuxt 4**:
   - Trích xuất toàn bộ yêu cầu kỹ thuật của **[TASK HIỆN TẠI]** thuộc **[SPRINT HIỆN TẠI]** trong `@docs/ke_hoach.md` (kết hợp đối chiếu với Phần I, II, III của tài liệu nếu liên quan).
   - Tự động ánh xạ đường dẫn file sang chuẩn Nuxt `^4.6.3`: đặt `components/`, `composables/`, `stores/`, `assets/`, `pages/`, `types/` vào trong thư mục `app/`; giữ nguyên `server/`, `public/` và `nuxt.config.ts` ở thư mục gốc.

2. **Kiểm tra & Cài đặt Thư viện (Dependencies)**:
   - Đối chiếu các công nghệ cần dùng trong **[TASK HIỆN TẠI]** với `@package.json`.
   - Nếu thiếu package nào cho Task này, hãy chạy lệnh cài đặt phiên bản tương thích với Nuxt 4 và Vue 3.5 trước khi viết code.

3. **Thiết kế TypeScript Interfaces/Types**:
   - Tạo hoặc cập nhật các file Type/Interface liên quan đến **[TASK HIỆN TẠI]** với chế độ TypeScript Strict (tuyệt đối KHÔNG dùng `any`), bám sát cấu trúc JSON 1 Document/1 User và Schema bài học trong `@docs/ke_hoach.md`.

4. **Viết Code Hoàn Chỉnh (Production-Ready, Bảo mật & Tối ưu)**:
   - Viết đầy đủ 100% mã nguồn của các file thuộc **[TASK HIỆN TẠI]** (tuyệt đối KHÔNG viết tắt, KHÔNG để lại `// TODO` hay `// ...rest of code`).
   - Áp dụng cú pháp Vue 3.5+ hiện đại nhất, đảm bảo hiệu năng 60FPS, dọn dẹp sạch sẽ bộ nhớ/timers/audio khi unmount, và tuân thủ tuyệt đối các quy tắc bảo mật/chống hack/tiết kiệm quota Firebase & Vercel trong `@docs/ke_hoach.md`.

5. **Kiểm tra Lỗi & Đối chiếu Nghiệm thu (DoD)**:
   - Chạy kiểm tra lỗi cú pháp/TypeScript (`npx nuxi typecheck`) và tự sửa triệt để nếu có lỗi phát sinh.
   - Nếu **[TASK HIỆN TẠI]** là mục cuối cùng của **[SPRINT HIỆN TẠI]**, hãy tự động rà soát toàn bộ Sprint theo mục **"Tiêu chí nghiệm thu (DoD)"** trong `@docs/ke_hoach.md` và báo cáo kết quả.