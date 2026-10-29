<script setup lang="ts">
/**
 * EngVerse - Dynamic Open Graph (OG) Image Card Template
 * Rendered server-side by Satori/nuxt-og-image for social media scrapers (Facebook, Zalo, Twitter).
 *
 * Strict Flexbox design compliant with Satori CSS specifications.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 2)
 */

interface Props {
  displayName?: string;
  avatar?: string;
  level?: number;
  streak?: number;
  equippedTitle?: string;
  worldTrack?: string;
  exp?: number;
  cardsCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  displayName: 'Nhà Thám Hiểm',
  avatar: 'rookie_explorer',
  level: 1,
  streak: 1,
  equippedTitle: 'Tân Binh Đa Vũ Trụ',
  worldTrack: 'kids',
  exp: 100,
  cardsCount: 1,
});

function getTrackLabel(track: string): string {
  switch (track) {
    case 'kids':
      return '🏝️ Đảo Thần Thoại';
    case 'teens':
      return '⚡ Cyber City';
    case 'adults':
      return '🌐 SimLife Global';
    default:
      return '✨ Đa Vũ Trụ EngVerse';
  }
}

function getAvatarEmoji(avatar: string): string {
  if (avatar.includes('dragon') || avatar.includes('rider')) return '🐉';
  if (avatar.includes('cyber') || avatar.includes('sleuth') || avatar.includes('hacker')) return '🕵️‍♂️';
  if (avatar.includes('global') || avatar.includes('ceo') || avatar.includes('business')) return '💼';
  if (avatar.includes('fairy')) return '🧚';
  return '🚀';
}
</script>

<template>
  <div
    style="
      width: 1200px;
      height: 630px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 56px;
      background: linear-gradient(135deg, #070a12 0%, #0f172a 45%, #1e1b4b 100%);
      font-family: 'Be Vietnam Pro', sans-serif;
      color: #ffffff;
      box-sizing: border-box;
      position: relative;
    "
  >
    <!-- Top Row: Branding & Universe Badge -->
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      "
    >
      <div style="display: flex; align-items: center; gap: 14px;">
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
            box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
            font-size: 26px;
          "
        >
          ⚡
        </div>
        <div style="display: flex; flex-direction: column;">
          <span
            style="
              font-size: 28px;
              font-weight: 900;
              letter-spacing: -0.5px;
              color: #ffffff;
            "
          >
            EngVerse
          </span>
          <span
            style="
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 2px;
              color: #38bdf8;
              text-transform: uppercase;
            "
          >
            Bảng Vàng Vinh Danh
          </span>
        </div>
      </div>

      <!-- Universe Pill -->
      <div
        style="
          display: flex;
          align-items: center;
          padding: 10px 22px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 16px;
          font-weight: 800;
          color: #f1f5f9;
        "
      >
        {{ getTrackLabel(props.worldTrack) }}
      </div>
    </div>

    <!-- Center Hero Section: Avatar, Title & Name -->
    <div
      style="
        display: flex;
        align-items: center;
        gap: 36px;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 28px;
        padding: 32px 40px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      "
    >
      <!-- Avatar with Level Ring -->
      <div
        style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 140px;
          height: 140px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border: 4px solid #38bdf8;
          box-shadow: 0 0 30px rgba(56, 189, 248, 0.35);
          font-size: 68px;
        "
      >
        <span>{{ getAvatarEmoji(props.avatar) }}</span>
        <!-- Level Tag -->
        <div
          style="
            position: absolute;
            bottom: -8px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px 14px;
            border-radius: 9999px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border: 2px solid #ffffff;
            font-size: 14px;
            font-weight: 900;
            color: #ffffff;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          "
        >
          Lv.{{ props.level }}
        </div>
      </div>

      <!-- Identity & Equipped Title -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <!-- Equipped Title Badge -->
        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            align-self: flex-start;
            padding: 6px 18px;
            border-radius: 9999px;
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.4);
            font-size: 15px;
            font-weight: 800;
            color: #fbbf24;
          "
        >
          <span>👑</span>
          <span>{{ props.equippedTitle }}</span>
        </div>

        <!-- Player Name -->
        <div
          style="
            font-size: 44px;
            font-weight: 900;
            line-height: 1.1;
            color: #ffffff;
            letter-spacing: -1px;
          "
        >
          {{ props.displayName }}
        </div>

        <div style="font-size: 16px; color: #94a3b8; font-weight: 500;">
          Đã mở khóa vinh danh chiến binh ngôn ngữ trên EngVerse
        </div>
      </div>
    </div>

    <!-- Bottom Row: 3 Highlight Badges -->
    <div
      style="
        display: flex;
        justify-content: space-between;
        gap: 20px;
        width: 100%;
      "
    >
      <!-- Streak Stat -->
      <div
        style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        "
      >
        <span style="font-size: 38px;">🔥</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 26px; font-weight: 900; color: #f97316;">
            {{ props.streak }} Ngày
          </span>
          <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">
            Chuỗi Học Tập (Streak)
          </span>
        </div>
      </div>

      <!-- EXP Stat -->
      <div
        style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        "
      >
        <span style="font-size: 38px;">⭐</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 26px; font-weight: 900; color: #38bdf8;">
            {{ props.exp }} EXP
          </span>
          <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">
            Tổng Kinh Nghiệm
          </span>
        </div>
      </div>

      <!-- Codex Cards Stat -->
      <div
        style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        "
      >
        <span style="font-size: 38px;">🃏</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 26px; font-weight: 900; color: #a855f7;">
            {{ props.cardsCount }} Thẻ
          </span>
          <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">
            Bộ Sưu Tập Codex
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
