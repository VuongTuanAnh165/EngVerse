/**
 * EngVerse - Rewards System Type Contracts & Definitions
 * Strictly typed (0 any), multi-universe rewards for Boss Rush Colosseum & Streaks.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & Task 3.5.
 */

export type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type AvatarFrameId =
  | 'default'
  | 'avatar_frame_gold'
  | 'avatar_frame_cyber'
  | 'avatar_frame_mythic';

export type TitleBadgeId =
  | 'rookie_explorer'
  | 'title_boss_slayer'
  | 'title_multiverse_champion'
  | 'streak_master'
  | 'streak_immortal';

export interface AvatarFrameDefinition {
  id: AvatarFrameId;
  name: string;
  description: string;
  icon: string;
  rarity: RewardRarity;
  unlockCondition: string;
  cssClass: string;
}

export interface TitleBadgeDefinition {
  id: TitleBadgeId;
  name: string;
  description: string;
  icon: string;
  rarity: RewardRarity;
  unlockCondition: string;
}

export const ALL_AVATAR_FRAMES: Record<AvatarFrameId, AvatarFrameDefinition> = {
  default: {
    id: 'default',
    name: 'Khung Cơ Bản (Explorer)',
    description: 'Khung mặc định dành cho mọi Nhà Thám Hiểm khi gia nhập Đa Vũ Trụ EngVerse.',
    icon: '🧭',
    rarity: 'common',
    unlockCondition: 'Có sẵn từ đầu.',
    cssClass: 'default-avatar-frame',
  },
  avatar_frame_gold: {
    id: 'avatar_frame_gold',
    name: 'Khung Hoàng Kim (Golden Sunstone)',
    description: 'Hào quang vàng rực rỡ lấp lánh biểu tượng cho chiến thần bất bại của Đấu Trường.',
    icon: '👑',
    rarity: 'legendary',
    unlockCondition: 'Hạ gục 4/4 Boss Colosseum hoặc Đạt Chuỗi Học Tập 60 Ngày.',
    cssClass: 'gold-avatar-frame',
  },
  avatar_frame_cyber: {
    id: 'avatar_frame_cyber',
    name: 'Khung Cyber Nexus (Neon Pulse)',
    description: 'Khung lượng tử phát xung ánh sáng Neon Cyan & Magenta của thế giới mạng Cyber City.',
    icon: '⚡',
    rarity: 'epic',
    unlockCondition: 'Vượt qua Đấu Trường Teens (Cyber Nexus).',
    cssClass: 'cyber-avatar-frame',
  },
  avatar_frame_mythic: {
    id: 'avatar_frame_mythic',
    name: 'Khung Thần Thoại (Multiverse Void)',
    description: 'Vòng xoáy đa chiều không gian tỏa ánh sáng tinh tú vô tận của Bá Chủ Đa Vũ Trụ.',
    icon: '🌌',
    rarity: 'mythic',
    unlockCondition: 'Phá đảo Đấu Trường Boss Rush ở cả 3 Vũ Trụ (Kids, Teens, Adults).',
    cssClass: 'mythic-avatar-frame',
  },
};

export const ALL_TITLE_BADGES: Record<TitleBadgeId, TitleBadgeDefinition> = {
  rookie_explorer: {
    id: 'rookie_explorer',
    name: 'Tân Binh Đa Vũ Trụ',
    description: 'Người vừa đặt chân khám phá hành trình chinh phục tiếng Anh.',
    icon: '🌱',
    rarity: 'common',
    unlockCondition: 'Gia nhập EngVerse.',
  },
  title_boss_slayer: {
    id: 'title_boss_slayer',
    name: 'Vua Đấu Trường',
    description: 'Chiến thần dũng mãnh đã đánh bại chuỗi 4 Đại Boss liên hoàn trong Đấu Trường Sinh Tử.',
    icon: '🏆',
    rarity: 'legendary',
    unlockCondition: 'Hạ gục 4/4 Đại Boss trong một lượt khiêu chiến Colosseum.',
  },
  title_multiverse_champion: {
    id: 'title_multiverse_champion',
    name: 'Bá Chủ Đa Vũ Trụ',
    description: 'Danh hiệu tối thượng chứng nhận người chơi đã chinh phục thành công cả 3 Đấu Trường (Kids, Teens, Adults).',
    icon: '💎',
    rarity: 'mythic',
    unlockCondition: 'Hoàn thành Đấu Trường Boss Rush ở cả 3 Vũ Trụ.',
  },
  streak_master: {
    id: 'streak_master',
    name: 'Bậc Thầy Kiên Trì',
    description: 'Biểu tượng của ngọn lửa kỷ luật bền bỉ, duy trì việc học không gián đoạn.',
    icon: '🔥',
    rarity: 'rare',
    unlockCondition: 'Duy trì Chuỗi Học Tập đạt 30 ngày.',
  },
  streak_immortal: {
    id: 'streak_immortal',
    name: 'Bất Tử Học Tập',
    description: 'Huyền thoại sống của Đa Vũ Trụ với ý chí thép bất khả chiến bại.',
    icon: '⚡',
    rarity: 'epic',
    unlockCondition: 'Duy trì Chuỗi Học Tập đạt 60 ngày.',
  },
};

/**
 * Maps raw title ID or legacy Vietnamese title string to human-friendly display name
 */
export function getTitleDisplayName(rawTitle: string | undefined): string {
  if (!rawTitle) return 'Tân Binh Đa Vũ Trụ';
  if (rawTitle in ALL_TITLE_BADGES) {
    return ALL_TITLE_BADGES[rawTitle as TitleBadgeId].name;
  }
  if (rawTitle === 'Tân Binh' || rawTitle === 'rookie_explorer') {
    return 'Tân Binh Đa Vũ Trụ';
  }
  return rawTitle;
}

/**
 * Returns frame definition with safe fallback to default
 */
export function getAvatarFrameDefinition(frameId: string | undefined): AvatarFrameDefinition {
  if (frameId && frameId in ALL_AVATAR_FRAMES) {
    return ALL_AVATAR_FRAMES[frameId as AvatarFrameId];
  }
  return ALL_AVATAR_FRAMES.default;
}

