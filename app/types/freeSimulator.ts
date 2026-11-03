/**
 * EngVerse - AI Free Simulator Types & Presets
 * Strictly typed definitions for lifelong conversational simulation and CEFR evaluation.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4 & Task 4.1
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type SimulatorCategory =
  | 'travel'
  | 'work'
  | 'health'
  | 'daily'
  | 'study'
  | 'advanced';

export type NpcPersonaType = 'friendly' | 'professional' | 'challenging';

export type SimulationTurnsOption = 8 | 12 | 15;

/**
 * Metadata for simulator categories
 */
export interface CategoryMeta {
  id: SimulatorCategory;
  name: string;
  nameEn: string;
  emoji: string;
  badgeColor: string;
  description: string;
}

/**
 * Recommended vocabulary with Vietnamese meaning
 */
export interface ScenarioVocabHint {
  word: string;
  meaningVi: string;
  phonics?: string;
}

/**
 * Preset conversational scenario configuration
 */
export interface PresetScenario {
  id: string;
  category: SimulatorCategory;
  title: string;
  titleVi: string;
  emoji: string;
  targetCefr: CEFRLevel;
  difficultyRating: 1 | 2 | 3 | 4 | 5;
  npcName: string;
  npcRole: string;
  npcAvatar: string;
  userRole: string;
  description: string;
  objectives: string[];
  sampleOpening: string;
  recommendedVocab: ScenarioVocabHint[];
  suggestedTurns: SimulationTurnsOption;
}

/**
 * Custom scenario configuration typed input
 */
export interface CustomScenarioConfig {
  userPrompt: string;
  userRole: string;
  npcRole: string;
  npcName: string;
  targetCefr: CEFRLevel | 'auto';
  turnsCount: SimulationTurnsOption;
  npcPersona: NpcPersonaType;
}

/**
 * Granular CEFR Scorecard structure
 */
export interface CEFRScorecard {
  overallLevel: CEFRLevel;
  overallScore: number; // 0–100
  summary: string;

  lexicalResource: {
    score: number; // 0–100
    wordsUsed: string[];
    suggestedUpgrades: Array<{
      original: string;
      upgraded: string;
      contextVi: string;
    }>;
  };

  grammaticalAccuracy: {
    score: number; // 0–100
    errorsFound: Array<{
      userSaid: string;
      corrected: string;
      explanation: string; // Tiếng Việt
    }>;
  };

  pronunciation: {
    score: number; // 0–100
    fluencyRating: 'choppy' | 'fair' | 'smooth' | 'native-like';
    problematicSounds: string[]; // e.g. ["/θ/", "/ɪ/ vs /iː/"]
  };

  communicativeCompetence: {
    score: number; // 0–100
    strengths: string[];
    areasToImprove: string[];
  };
}

/**
 * Record of a single completed simulation session (embedded in users/{uid})
 */
export interface FreeSimSessionRecord {
  sessionId: string;
  scenarioId?: string;
  scenarioTitle: string;
  category: SimulatorCategory | 'custom';
  targetCefr: CEFRLevel;
  achievedCefr: CEFRLevel;
  completedAt: number; // Unix timestamp ms
  turnsCount: number;
  scorecard: CEFRScorecard;
}

/**
 * User persistent state inside users/{uid}.freeSimulator (0 subcollection)
 */
export interface UserFreeSimulatorProgress {
  dailySessionsCount: number;
  lastPlayedDate: string; // Format: YYYY-MM-DD
  totalSessionsCompleted: number;
  history: FreeSimSessionRecord[]; // Max 5 recent records
}

// ---------------------------------------------------------------------------
// Constants & Static Metadata
// ---------------------------------------------------------------------------

export const MAX_DAILY_FREE_SIM_SESSIONS = 5;

export const CATEGORY_METAS: Record<SimulatorCategory, CategoryMeta> = {
  travel: {
    id: 'travel',
    name: 'Du Lịch & Khám Phá',
    nameEn: 'Travel & Hospitality',
    emoji: '🛫',
    badgeColor: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    description: 'Check-in khách sạn, hỏi đường ở London, bắt taxi, đổi ngoại tệ...',
  },
  work: {
    id: 'work',
    name: 'Công Việc & Sự Nghiệp',
    nameEn: 'Work & Career',
    emoji: '💼',
    badgeColor: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    description: 'Phỏng vấn xin việc, họp team Agile, thuyết trình dự án, đàm phán lương...',
  },
  health: {
    id: 'health',
    name: 'Y Tế & Cứu Hộ',
    nameEn: 'Health & Emergency',
    emoji: '🏥',
    badgeColor: 'linear-gradient(135deg, #10b981, #059669)',
    description: 'Khám bệnh tại phòng khám quốc tế, mua thuốc theo toa, xử lý cấp cứu...',
  },
  daily: {
    id: 'daily',
    name: 'Đời Sống Hàng Ngày',
    nameEn: 'Daily Life & Social',
    emoji: '📱',
    badgeColor: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: 'Gọi món tại nhà hàng, mặc cả tại chợ đêm, kết bạn quốc tế, đặt hẹn...',
  },
  study: {
    id: 'study',
    name: 'Học Tập & Du Học',
    nameEn: 'Study & Academic',
    emoji: '🎓',
    badgeColor: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    description: 'Luyện thi IELTS Speaking Part 1-3, tham gia seminar, tranh biện học thuật...',
  },
  advanced: {
    id: 'advanced',
    name: 'Thương Thuyết & Cao Cấp',
    nameEn: 'Business & Negotiation',
    emoji: '🌐',
    badgeColor: 'linear-gradient(135deg, #ec4899, #be185d)',
    description: 'Phỏng vấn Visa du lịch Mỹ, đàm phán sáp nhập M&A, họp báo giải quyết khủng hoảng...',
  },
};

export const CUSTOM_PROMPT_SUGGESTIONS: Array<{ label: string; prompt: string; category: SimulatorCategory; targetCefr: CEFRLevel }> = [
  {
    label: '🇺🇸 Phỏng vấn Visa du lịch Mỹ',
    prompt: 'Tôi sắp có buổi phỏng vấn xin Visa du lịch Mỹ B1/B2 tại Đại sứ quán. Hãy đóng vai viên chức lãnh sự quán kiểm tra lý do và ràng buộc tài chính của tôi.',
    category: 'advanced',
    targetCefr: 'B2',
  },
  {
    label: '🛍️ Trả giá chợ đêm Bangkok',
    prompt: 'Tôi đang dạo chợ đêm và muốn mua một chiếc áo lưu niệm thủ công. Người bán hét giá khá cao và tôi muốn mặc cả lịch sự nhưng cương quyết.',
    category: 'daily',
    targetCefr: 'A2',
  },
  {
    label: '💼 Đàm phán mức lương kỳ vọng',
    prompt: 'Tôi vừa vượt qua vòng kỹ thuật và đang đàm phán mức đãi ngộ với Trưởng phòng nhân sự. Tôi muốn đề xuất tăng 15% so với mức sàn.',
    category: 'work',
    targetCefr: 'B2',
  },
  {
    label: '🏨 Phàn nàn phòng khách sạn ồn ào',
    prompt: 'Phòng khách sạn của tôi ở tầng 3 bị ồn do công trường cạnh bên và máy lạnh rò rỉ nước. Tôi muốn xuống quầy lễ tân yêu cầu đổi sang phòng Deluxe trên cao.',
    category: 'travel',
    targetCefr: 'B1',
  },
  {
    label: '🎓 Luyện IELTS Speaking Part 2',
    prompt: 'Đóng vai giám khảo IELTS chấm thi Speaking Part 2 và Part 3 với chủ đề "Describe an artificial intelligence technology that has changed society".',
    category: 'study',
    targetCefr: 'C1',
  },
  {
    label: '💊 Mua thuốc cảm sốt tại Tokyo',
    prompt: 'Tôi bị đau đầu, ngạt mũi và sốt nhẹ khi đi du lịch. Tôi vào hiệu thuốc tây cần dược sĩ tư vấn loại thuốc không gây buồn ngủ.',
    category: 'health',
    targetCefr: 'A2',
  },
];

export const PRESET_SCENARIOS: PresetScenario[] = [
  // 1. TRAVEL
  {
    id: 'travel_hotel_checkin',
    category: 'travel',
    title: 'Hotel Check-in & Room Upgrade',
    titleVi: 'Check-in Khách Sạn & Nâng Hạng Phòng',
    emoji: '🏨',
    targetCefr: 'B1',
    difficultyRating: 2,
    npcName: 'Claire',
    npcRole: 'Senior Front Desk Agent at Grand Horizon Hotel',
    npcAvatar: '👩‍💼',
    userRole: 'Tired International Traveler with booking reservation',
    description: 'Bạn vừa đáp chuyến bay đêm đến London và đến quầy check-in. Bạn cần xác nhận đặt phòng, yêu cầu phòng tầng cao yên tĩnh và hỏi cách nâng hạng phòng.',
    objectives: [
      'Xác nhận thông tin đặt phòng qua mã xác nhận hoặc tên',
      'Yêu cầu phòng yên tĩnh tầng cao nhìn ra quang cảnh thành phố',
      'Hỏi về giờ phục vụ bữa sáng miễn phí và mật khẩu Wifi',
    ],
    sampleOpening: 'Good evening! Welcome to the Grand Horizon Hotel. How may I assist you with your stay tonight?',
    recommendedVocab: [
      { word: 'reservation', meaningVi: 'đơn đặt chỗ trước' },
      { word: 'complimentary breakfast', meaningVi: 'bữa sáng miễn phí' },
      { word: 'deluxe room upgrade', meaningVi: 'nâng hạng phòng cao cấp' },
      { word: 'wake-up call', meaningVi: 'cuộc gọi báo thức' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'travel_lost_luggage',
    category: 'travel',
    title: 'Lost Baggage at Airport Helpdesk',
    titleVi: 'Trình Báo Thất Lạc Hành Lý Tại Sân Bay',
    emoji: '🧳',
    targetCefr: 'B1',
    difficultyRating: 3,
    npcName: 'Officer Miller',
    npcRole: 'Airport Baggage Service Specialist',
    npcAvatar: '👮‍♂️',
    userRole: 'Passenger whose suitcase did not arrive on conveyor belt',
    description: 'Băng chuyền hành lý đã dừng nhưng vali màu đen của bạn không xuất hiện. Hãy đến quầy Lost & Found miêu tả đặc điểm vali và điền đơn theo dõi.',
    objectives: [
      'Thông báo vali không xuất hiện trên băng chuyền sau chuyến bay',
      'Mô tả chi tiết kiểu dáng, màu sắc và nhãn hiệu vali',
      'Cung cấp địa chỉ khách sạn để nhân viên chuyển trả vali khi tìm thấy',
    ],
    sampleOpening: 'Hello there. Please stay calm. Let me take your boarding pass and luggage claim tag to check our tracking system.',
    recommendedVocab: [
      { word: 'baggage claim tag', meaningVi: 'thẻ hành lý gửi' },
      { word: 'hard-shell suitcase', meaningVi: 'vali vỏ cứng' },
      { word: 'missing luggage report', meaningVi: 'báo cáo hành lý thất lạc' },
      { word: 'courier delivery', meaningVi: 'chuyển phát tận nơi' },
    ],
    suggestedTurns: 12,
  },
  {
    id: 'travel_ask_directions',
    category: 'travel',
    title: 'Navigating the Subway Station',
    titleVi: 'Hỏi Đường & Mua Vé Tàu Điện Ngầm',
    emoji: '🚇',
    targetCefr: 'A2',
    difficultyRating: 1,
    npcName: 'David',
    npcRole: 'Subway Station Customer Assistant',
    npcAvatar: '👨‍✈️',
    userRole: 'First-time tourist trying to reach the National Museum',
    description: 'Bạn đang đứng ở ga trung tâm đông đúc, máy bán vé tự động chỉ nhận thẻ địa phương. Hãy hỏi nhân viên cách nạp tiền thẻ hoặc mua vé đi đến Viện Bảo Tàng.',
    objectives: [
      'Hỏi tuyến tàu điện nào đi thẳng đến Viện Bảo Tàng',
      'Hỏi giá vé một chiều và cách thanh toán',
      'Hỏi sân ga đón tàu (Platform) số mấy',
    ],
    sampleOpening: 'Hi! You look a bit lost with the station map. Can I help you find your train?',
    recommendedVocab: [
      { word: 'one-way ticket', meaningVi: 'vé một chiều' },
      { word: 'transfer line', meaningVi: 'chuyển tuyến tàu' },
      { word: 'platform number', meaningVi: 'số sân ga' },
      { word: 'contactless payment', meaningVi: 'thanh toán không tiếp xúc' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'travel_taxi_uber',
    category: 'travel',
    title: 'Riding a Taxi to Convention Center',
    titleVi: 'Bắt Taxi Đến Trung Tâm Hội Nghị',
    emoji: '🚕',
    targetCefr: 'A2',
    difficultyRating: 2,
    npcName: 'Antonio',
    npcRole: 'Local City Cab Driver',
    npcAvatar: '🚖',
    userRole: 'Business delegate in a hurry',
    description: 'Bạn cần đến Trung tâm Hội nghị trong vòng 30 phút trước khi buổi họp khai mạc. Hãy trao đổi lộ trình và yêu cầu tài xế lấy hóa đơn.',
    objectives: [
      'Nêu điểm đến cụ thể và nhấn mạnh bạn đang cần đi gấp',
      'Hỏi tình hình giao thông trên tuyến đường cao tốc',
      'Thanh toán và yêu cầu hóa đơn (receipt) cho công ty',
    ],
    sampleOpening: 'Hop in! Where are we headed today, and do you prefer the highway or the local avenue?',
    recommendedVocab: [
      { word: 'fastest route', meaningVi: 'tuyến đường nhanh nhất' },
      { word: 'traffic congestion', meaningVi: 'ùn tắc giao thông' },
      { word: 'official receipt', meaningVi: 'hóa đơn chính thức' },
      { word: 'keep the change', meaningVi: 'giữ lại tiền thừa' },
    ],
    suggestedTurns: 8,
  },

  // 2. WORK & CAREER
  {
    id: 'work_job_interview',
    category: 'work',
    title: 'Tech Job Behavioral Interview',
    titleVi: 'Phỏng Vấn Hành Vi Tuyển Dụng',
    emoji: '💼',
    targetCefr: 'B2',
    difficultyRating: 4,
    npcName: 'Sarah Jenkins',
    npcRole: 'Director of Engineering & Hiring Manager',
    npcAvatar: '👩‍💼',
    userRole: 'Senior Software Engineer Candidate',
    description: 'Buổi phỏng vấn vòng chuyên môn cho vị trí Kỹ sư cấp cao. Nhà tuyển dụng sẽ hỏi phương pháp giải quyết xung đột ý kiến kỹ thuật và kinh nghiệm xử lý sự cố server.',
    objectives: [
      'Giới thiệu ngắn gọn kinh nghiệm nổi bật liên quan',
      'Trả lời tình huống theo phương pháp STAR (Situation, Task, Action, Result)',
      'Đặt 1-2 câu hỏi sâu sắc về văn hóa kỹ thuật của công ty',
    ],
    sampleOpening: 'Welcome to our office! We reviewed your profile and were impressed by your background. To start, could you walk me through a challenging technical decision you had to make recently?',
    recommendedVocab: [
      { word: 'system architecture', meaningVi: 'kiến trúc hệ thống' },
      { word: 'cross-functional team', meaningVi: 'đội ngũ đa bộ phận' },
      { word: 'trade-off analysis', meaningVi: 'phân tích điểm đánh đổi' },
      { word: 'scalability bottleneck', meaningVi: 'nút thắt mở rộng hệ thống' },
    ],
    suggestedTurns: 12,
  },
  {
    id: 'work_salary_negotiation',
    category: 'work',
    title: 'Salary & Compensation Negotiation',
    titleVi: 'Đàm Phán Mức Lương & Đãi Ngộ',
    emoji: '💰',
    targetCefr: 'B2',
    difficultyRating: 4,
    npcName: 'Marcus Wong',
    npcRole: 'VP of People & Talent Operations',
    npcAvatar: '👨‍💼',
    userRole: 'Job Candidate with an active Offer Letter',
    description: 'Bạn vừa nhận được thư mời làm việc nhưng con số lương cứng thấp hơn 12% so với kỳ vọng của bạn. Hãy đàm phán một cách tự tin, chuyên nghiệp và có căn cứ thị trường.',
    objectives: [
      'Bày tỏ sự hào hứng với cơ hội làm việc và giá trị công ty',
      'Đề xuất mức lương mong muốn dựa trên năng lực và dữ liệu thị trường',
      'Linh hoạt trao đổi về cổ phần (equity), thưởng năm hoặc số ngày nghỉ',
    ],
    sampleOpening: 'Hi! We were thrilled to send over the offer letter yesterday. Have you had a chance to look through the compensation package?',
    recommendedVocab: [
      { word: 'base compensation', meaningVi: 'lương cơ bản' },
      { word: 'market benchmark', meaningVi: 'mức chuẩn thị trường' },
      { word: 'annual performance bonus', meaningVi: 'thưởng hiệu suất hàng năm' },
      { word: 'sign-on bonus', meaningVi: 'tiền thưởng gia nhập' },
    ],
    suggestedTurns: 12,
  },
  {
    id: 'work_project_presentation',
    category: 'work',
    title: 'Project Pitch to Stakeholders',
    titleVi: 'Thuyết Trình Đề Án Trước Ban Giám Đốc',
    emoji: '📊',
    targetCefr: 'C1',
    difficultyRating: 5,
    npcName: 'Rachel Vance',
    npcRole: 'Chief Product Officer (CPO)',
    npcAvatar: '👩‍💻',
    userRole: 'Product Lead presenting Q3 Innovation Roadmap',
    description: 'Bạn đang bảo vệ dự án phát triển tính năng AI Voice Assistant trước ban giám đốc. Họ đặt câu hỏi nghi vấn về chi phí đầu tư hạ tầng và tỷ lệ giữ chân người dùng.',
    objectives: [
      'Nêu bật tác động cốt lõi của tính năng đối với trải nghiệm khách hàng',
      'Bảo vệ bài toán ROI (Return on Investment) và chỉ số dự phóng',
      'Xử lý phản biện sắc bén của CPO với phong thái điềm tĩnh',
    ],
    sampleOpening: 'Thank you for the slides. While the concept sounds futuristic, our cloud compute bill is already high. Why should we prioritize this AI initiative over improving core infrastructure?',
    recommendedVocab: [
      { word: 'user retention rate', meaningVi: 'tỷ lệ giữ chân người dùng' },
      { word: 'infrastructure overhead', meaningVi: 'chi phí hạ tầng' },
      { word: 'competitive edge', meaningVi: 'lợi thế cạnh tranh' },
      { word: 'milestone delivery', meaningVi: 'bàn giao theo cột mốc' },
    ],
    suggestedTurns: 15,
  },
  {
    id: 'work_agile_standup',
    category: 'work',
    title: 'Daily Agile Standup Meeting',
    titleVi: 'Báo Cáo Tiến Độ Họp Scrum Hàng Ngày',
    emoji: '⏱️',
    targetCefr: 'B1',
    difficultyRating: 2,
    npcName: 'Alex',
    npcRole: 'Scrum Master & Team Facilitator',
    npcAvatar: '👨‍🔧',
    userRole: 'Full-stack Developer on the squad',
    description: 'Họp ngắn 15 phút với Scrum Master. Hãy chia sẻ những gì bạn đã làm hôm qua, kế hoạch hôm nay và bất kỳ trở ngại (blocker) nào đang gặp phải.',
    objectives: [
      'Tóm tắt 2 công việc hoàn thành ngày hôm qua',
      'Nêu mục tiêu commit code hoặc kiểm thử ngày hôm nay',
      'Báo cáo 1 trở ngại cần trợ giúp từ bộ phận backend',
    ],
    sampleOpening: 'Morning everyone! Let us keep the updates crisp. What did you finish yesterday, what are you tackling today, and are there any blockers?',
    recommendedVocab: [
      { word: 'pull request review', meaningVi: 'duyệt nhánh mã nguồn' },
      { word: 'resolve dependencies', meaningVi: 'giải quyết xung đột thư viện' },
      { word: 'blocker', meaningVi: 'trở ngại chặn tiến độ' },
      { word: 'deploy to staging', meaningVi: 'triển khai môi trường thử nghiệm' },
    ],
    suggestedTurns: 8,
  },

  // 3. HEALTH & EMERGENCY
  {
    id: 'health_doctor_consultation',
    category: 'health',
    title: 'Consulting an International Clinic Doctor',
    titleVi: 'Khám Bệnh Tại Phòng Khám Quốc Tế',
    emoji: '🩺',
    targetCefr: 'B1',
    difficultyRating: 3,
    npcName: 'Dr. Emily Carter',
    npcRole: 'General Practitioner Physician',
    npcAvatar: '👩‍⚕️',
    userRole: 'Expat feeling sick for 3 consecutive days',
    description: 'Bạn bị đau họng dữ dội, sốt về đêm và đau nhức cơ bắp suốt 3 ngày. Bác sĩ cần khám và hỏi lịch sử dị ứng trước khi kê đơn.',
    objectives: [
      'Mô tả chính xác các triệu chứng và thời gian khởi phát',
      'Trả lời câu hỏi về tiền sử dị ứng thuốc và bệnh nền',
      'Hỏi về liều lượng dùng thuốc và chế độ ăn uống kiêng cữ',
    ],
    sampleOpening: 'Hello! Come on in and take a seat. What seems to be bothering you today, and how long have you had these symptoms?',
    recommendedVocab: [
      { word: 'persistent sore throat', meaningVi: 'đau họng dai dẳng' },
      { word: 'allergic reaction', meaningVi: 'phản ứng dị ứng' },
      { word: 'dosage instructions', meaningVi: 'hướng dẫn liều dùng' },
      { word: 'side effects', meaningVi: 'tác dụng phụ' },
    ],
    suggestedTurns: 12,
  },
  {
    id: 'health_pharmacy',
    category: 'health',
    title: 'Buying Over-the-Counter Medicine',
    titleVi: 'Mua Thuốc Không Cần Kê Đơn Tại Nhà Thuốc',
    emoji: '💊',
    targetCefr: 'A2',
    difficultyRating: 1,
    npcName: 'Pharmacist Liam',
    npcRole: 'Licensed Community Pharmacist',
    npcAvatar: '👨‍⚕️',
    userRole: 'Customer with seasonal allergy and headache',
    description: 'Bạn muốn mua thuốc chống dị ứng phấn hoa và thuốc giảm đau nhưng bạn cần lái xe đường dài nên thuốc tuyệt đối không được gây buồn ngủ.',
    objectives: [
      'Yêu cầu thuốc dị ứng và thuốc giảm đau',
      'Nhấn mạnh yêu cầu thuốc không gây buồn ngủ (non-drowsy)',
      'Hỏi rõ uống trước hay sau bữa ăn',
    ],
    sampleOpening: 'Hi there! How can I help you today? Are you looking for a prescription refill or over-the-counter remedy?',
    recommendedVocab: [
      { word: 'non-drowsy formula', meaningVi: 'công thức không gây buồn ngủ' },
      { word: 'pain reliever', meaningVi: 'thuốc giảm đau' },
      { word: 'take with meals', meaningVi: 'uống kèm trong bữa ăn' },
      { word: 'seasonal allergy', meaningVi: 'dị ứng theo mùa' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'health_emergency_911',
    category: 'health',
    title: 'Calling 911 Emergency Dispatcher',
    titleVi: 'Gọi Cấp Cứu 911 Xử Lý Tai Nạn',
    emoji: '🚑',
    targetCefr: 'B2',
    difficultyRating: 4,
    npcName: 'Dispatcher Roberts',
    npcRole: 'Emergency Service Coordinator',
    npcAvatar: '🚨',
    userRole: 'Bystander witnessing a bicycle accident',
    description: 'Bạn chứng kiến một người đi xe đạp bị trượt ngã trên đường ray và bất tỉnh. Bạn phải giữ bình tĩnh để cung cấp địa chỉ chính xác và làm theo hướng dẫn sơ cứu.',
    objectives: [
      'Báo cáo tình huống tai nạn và trạng thái nạn nhân rõ ràng',
      'Xác nhận địa chỉ giao lộ hoặc mốc địa lý nhận diện',
      'Thực hiện theo chỉ dẫn kiểm tra nhịp thở sơ cứu tạm thời',
    ],
    sampleOpening: '911 Emergency. What is the exact location of your emergency, and do you require police, fire, or ambulance?',
    recommendedVocab: [
      { word: 'unconscious victim', meaningVi: 'nạn nhân bất tỉnh' },
      { word: 'intersection of streets', meaningVi: 'ngã tư giao cắt' },
      { word: 'first-aid instructions', meaningVi: 'hướng dẫn sơ cứu ban đầu' },
      { word: 'paramedics dispatched', meaningVi: 'nhân viên cấp cứu đã xuất phát' },
    ],
    suggestedTurns: 8,
  },

  // 4. DAILY LIFE & SOCIAL
  {
    id: 'daily_restaurant_ordering',
    category: 'daily',
    title: 'Fine Dining Restaurant Experience',
    titleVi: 'Gọi Món & Yêu Cầu Dị Ứng Tại Nhà Hàng',
    emoji: '🍽️',
    targetCefr: 'A2',
    difficultyRating: 2,
    npcName: 'Matteo',
    npcRole: 'Head Waiter at Le Petit Bistro',
    npcAvatar: '🤵',
    userRole: 'Diner celebrating a friend anniversary',
    description: 'Bạn cùng bạn bè dùng bữa tối. Bạn muốn nhân viên tư vấn món đặc trưng của quán, đồng thời thông báo bạn bị dị ứng hạt đậu phộng.',
    objectives: [
      'Hỏi về món đặc sản (chef recommendation) trong ngày',
      'Yêu cầu đặc biệt về không chứa đậu phộng (peanut allergy)',
      'Gọi tráng miệng và yêu cầu tính tiền tách bill',
    ],
    sampleOpening: 'Bonsoir! Welcome to Le Petit Bistro. May I start you off with some sparkling water or our house aperitif while you look over the menu?',
    recommendedVocab: [
      { word: 'chef special', meaningVi: 'món đặc sắc của bếp trưởng' },
      { word: 'severe nut allergy', meaningVi: 'dị ứng nghiêm trọng với các loại hạt' },
      { word: 'split the bill', meaningVi: 'chia hóa đơn thanh toán' },
      { word: 'medium-rare steak', meaningVi: 'bít tết chín vừa tái' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'daily_night_market_bargaining',
    category: 'daily',
    title: 'Bargaining at a Weekend Flea Market',
    titleVi: 'Mặc Cả Đồ Lưu Niệm Chợ Đồ Cũ Cuối Tuần',
    emoji: '🏺',
    targetCefr: 'B1',
    difficultyRating: 2,
    npcName: 'Uncle Sam',
    npcRole: 'Experienced Antique & Souvenir Vendor',
    npcAvatar: '🧔',
    userRole: 'Smart shopper looking for handmade gifts',
    description: 'Người bán hàng chào giá chiếc đồng hồ cát bằng đồng cổ với giá 60 USD. Bạn muốn mua 2 chiếc và đàm phán mức giá hữu nghị 40 USD/chiếc.',
    objectives: [
      'Hỏi nguồn gốc và chất liệu của món đồ thủ công',
      'Đề xuất mua số lượng nhiều để được chiết khấu hợp lý',
      'Thỏa thuận mức giá đôi bên cùng có lợi một cách vui vẻ',
    ],
    sampleOpening: 'Welcome, friend! You have great taste. That vintage brass hourglass is an authentic handcrafted piece. Yours today for just sixty dollars!',
    recommendedVocab: [
      { word: 'handcrafted piece', meaningVi: 'món đồ làm thủ công' },
      { word: 'best possible deal', meaningVi: 'mức giá tốt nhất có thể' },
      { word: 'bundle discount', meaningVi: 'giảm giá khi mua theo gói' },
      { word: 'fair agreement', meaningVi: 'thỏa thuận công bằng' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'daily_roommate_conflict',
    category: 'daily',
    title: 'Resolving Shared Apartment Chores',
    titleVi: 'Hòa Giải Phân Chia Việc Nhà Với Bạn Cùng Phòng',
    emoji: '🏠',
    targetCefr: 'B2',
    difficultyRating: 3,
    npcName: 'Jordan',
    npcRole: 'Busy College Roommate',
    npcAvatar: '👱‍♂️',
    userRole: 'Tidy Flatmate frustrated with kitchen mess',
    description: 'Bồn rửa chén trong căn hộ chung đầy ắp đĩa bẩn suốt 2 ngày và rác chưa đổ. Hãy ngồi xuống trò chuyện thẳng thắn nhưng hòa nhã để lập lịch dọn dẹp công bằng.',
    objectives: [
      'Mở lời khéo léo về vấn đề không gian sinh hoạt chung',
      'Lắng nghe lý do bận rộn từ bạn cùng phòng mà không phán xét gay gắt',
      'Cùng nhau thống nhất bảng phân công việc nhà cụ thể theo ngày',
    ],
    sampleOpening: 'Hey! I noticed you wanted to chat about the apartment. Is something on your mind? I have been completely swamped with finals this week.',
    recommendedVocab: [
      { word: 'shared living space', meaningVi: 'không gian sinh hoạt chung' },
      { word: 'chore schedule', meaningVi: 'lịch phân công việc nhà' },
      { word: 'take turns doing dishes', meaningVi: 'luân phiên rửa bát' },
      { word: 'mutual respect', meaningVi: 'sự tôn trọng lẫn nhau' },
    ],
    suggestedTurns: 12,
  },

  // 5. STUDY & ACADEMIC
  {
    id: 'study_ielts_speaking',
    category: 'study',
    title: 'IELTS Speaking Mock Test Part 3',
    titleVi: 'Thi Thử IELTS Speaking Part 3: Công Nghệ & Xã Hội',
    emoji: '🎙️',
    targetCefr: 'B2',
    difficultyRating: 4,
    npcName: 'Examiner Hughes',
    npcRole: 'Certified British Council IELTS Speaking Examiner',
    npcAvatar: '👨‍🏫',
    userRole: 'IELTS Candidate aiming for Band 7.5+',
    description: 'Giám khảo hỏi các câu hỏi thảo luận trừu tượng về tác động của trí tuệ nhân tạo đối với việc làm của thế hệ trẻ và giáo dục trong tương lai.',
    objectives: [
      'Phát triển câu trả lời dài với cấu trúc PEEL (Point, Explanation, Example, Link)',
      'Sử dụng các từ nối học thuật (Furthermore, In contrast, Consequently)',
      'Bày tỏ quan điểm đa chiều về thách thức và cơ hội',
    ],
    sampleOpening: 'We have been talking about technology in everyday life, and now I would like to ask you some broader questions related to this. Do you believe automation will eliminate more jobs than it creates in the coming decade?',
    recommendedVocab: [
      { word: 'disruptive technology', meaningVi: 'công nghệ đột phá thay đổi thị trường' },
      { word: 'ethical dilemma', meaningVi: 'song đề đạo đức' },
      { word: 'profound implications', meaningVi: 'những hệ lụy sâu sắc' },
      { word: 'upskill workforce', meaningVi: 'nâng cao tay nghề lực lượng lao động' },
    ],
    suggestedTurns: 12,
  },
  {
    id: 'study_academic_seminar',
    category: 'study',
    title: 'University Research Seminar Discussion',
    titleVi: 'Thảo Luận Nghiên Cứu Tại Giảng Đường Đại Học',
    emoji: '📚',
    targetCefr: 'C1',
    difficultyRating: 5,
    npcName: 'Professor Langdon',
    npcRole: 'Department Chair of Environmental Science',
    npcAvatar: '👨‍🎓',
    userRole: 'Graduate Student defending thesis methodology',
    description: 'Giáo sư đặt câu hỏi phản biện về phương pháp thu thập mẫu dữ liệu biến đổi khí hậu trong bài luận án thạc sĩ của bạn.',
    objectives: [
      'Bảo vệ tính hợp lệ của cỡ mẫu (sample size) và thuật toán phân tích',
      'Thừa nhận các giới hạn của nghiên cứu một cách khiêm tốn học thuật',
      'Đề xuất hướng mở rộng nghiên cứu trong tương lai',
    ],
    sampleOpening: 'Your hypothesis on urban heat islands is intriguing, yet your longitudinal dataset appears limited to two coastal cities. How do you justify generalizability to continental regions?',
    recommendedVocab: [
      { word: 'empirical evidence', meaningVi: 'bằng chứng thực nghiệm' },
      { word: 'statistical anomaly', meaningVi: 'dị thường thống kê' },
      { word: 'methodological rigor', meaningVi: 'sự chặt chẽ về phương pháp luận' },
      { word: 'peer-reviewed literature', meaningVi: 'tài liệu bình duyệt' },
    ],
    suggestedTurns: 15,
  },

  // 6. BUSINESS & NEGOTIATION
  {
    id: 'advanced_us_visa_interview',
    category: 'advanced',
    title: 'US Embassy Visa B1/B2 Interview',
    titleVi: 'Phỏng Vấn Xin Visa Du Lịch/Công Tác Mỹ (B1/B2)',
    emoji: '🇺🇸',
    targetCefr: 'B2',
    difficultyRating: 4,
    npcName: 'Consular Officer Hayes',
    npcRole: 'U.S. Embassy Consular Official',
    npcAvatar: '👮‍♀️',
    userRole: 'Visa Applicant applying for vacation & conference',
    description: 'Viên chức lãnh sự quán kiểm tra lý do bạn đến Mỹ, tài chính và các ràng buộc tại quê hương (công việc, gia đình, tài sản) để đảm bảo bạn sẽ quay về sau chuyến đi.',
    objectives: [
      'Nêu rõ ràng và ngắn gọn mục đích chuyến thăm và thời gian lưu trú',
      'Chứng minh công việc ổn định và ràng buộc chặt chẽ tại Việt Nam',
      'Trả lời dứt khoát, trung thực và tự tin nhìn thẳng vào viên chức',
    ],
    sampleOpening: 'Good morning. Pass your passport and DS-160 confirmation page through the window, please. What is the main purpose of your trip to the United States?',
    recommendedVocab: [
      { word: 'proof of financial ties', meaningVi: 'bằng chứng ràng buộc tài chính' },
      { word: 'round-trip itinerary', meaningVi: 'lịch trình khứ hồi' },
      { word: 'temporary business visitor', meaningVi: 'khách công tác tạm thời' },
      { word: 'return to current employment', meaningVi: 'quay lại công việc hiện tại' },
    ],
    suggestedTurns: 8,
  },
  {
    id: 'advanced_crisis_pr',
    category: 'advanced',
    title: 'Live Crisis Press Conference',
    titleVi: 'Họp Báo Xử Lý Khủng Hoảng Truyền Thông',
    emoji: '🎙️',
    targetCefr: 'C2',
    difficultyRating: 5,
    npcName: 'Reporter Dan Rather',
    npcRole: 'Investigative Senior Journalist from Global News',
    npcAvatar: '📰',
    userRole: 'Chief Spokesperson of Tech Corporation',
    description: 'Ứng dụng của công ty bị nghi rò rỉ dữ liệu của 10 triệu người dùng. Nhà báo liên tục chất vấn dồn dập về trách nhiệm và bồi thường.',
    objectives: [
      'Gửi lời xin lỗi chân thành và cam kết bảo vệ quyền lợi người dùng',
      'Nêu các biện pháp kỹ thuật và pháp lý khẩn cấp đã được kích hoạt',
      'Kiểm soát giọng điệu, không tỏ ra bối rối hay đổ lỗi cho bên thứ ba',
    ],
    sampleOpening: 'Spokesperson, your press release claims security is your top priority, yet millions of unencrypted records were found on dark forums. Did leadership actively conceal this breach for months?',
    recommendedVocab: [
      { word: 'full accountability', meaningVi: 'trách nhiệm giải trình toàn diện' },
      { word: 'independent third-party audit', meaningVi: 'kiểm toán độc lập từ bên thứ ba' },
      { word: 'mitigation measures', meaningVi: 'các biện pháp giảm thiểu rủi ro' },
      { word: 'uncompromising commitment', meaningVi: 'cam kết kiên định không thỏa hiệp' },
    ],
    suggestedTurns: 15,
  },
];

