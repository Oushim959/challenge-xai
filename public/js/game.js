/* ========================================
   محاكي رائد الأعمال - Game Engine v2
   Choice-Based with Consequences
   ======================================== */

// ============ API CONFIG ============
// GROQ_API_KEY: Set via window.__CONFIG (injected by server) or paste directly for local dev.
// Fish Audio keys live server-side in .env — the client only calls /api/fish-tts.
const CONFIG = {
    GROQ_API_KEY: (window.__CONFIG && window.__CONFIG.GROQ_API_KEY) || '',
    GROQ_MODEL: 'llama-3.3-70b-versatile',
    GROQ_ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions',

    // Fish Audio — keys are server-side; client sends text to proxy endpoint
    FISH_API_KEY: '',
    FISH_VOICE_ID: '',
    FISH_ENDPOINT: '/api/fish-tts',

    TIMER_DURATION: 60,
    TOTAL_STAGES: 7,
    INITIAL_BUDGET: 500000,
    INITIAL_REPUTATION: 50,
};

// ============ GAME STATE ============
const GameState = {
    playerName: '',
    sector: '',
    attitude: 3,
    voiceEnabled: true,
    businessModel: null,
    businessModelText: '',
    currentStage: 0,
    score: 0,
    budget: CONFIG.INITIAL_BUDGET,
    reputation: CONFIG.INITIAL_REPUTATION, // 0-100
    conversationHistory: [],
    stageResults: [],
    statusEffects: [],      // Active status effects from past choices
    decisionLog: [],        // Log of all decisions and their impacts
    timerInterval: null,
    timeRemaining: CONFIG.TIMER_DURATION,
    isWaitingForInput: false,
    isProcessing: false,
    gameStartTime: null,
    gameEndTime: null,
};

// ============ STAGE DEFINITIONS ============
const STAGES = [
    {
        id: 1,
        nameAr: 'التأسيس والتسجيل',
        nameEn: 'Registration & Setup',
        emoji: '📋',
        description: 'تسجيل الشركة والسجل التجاري',
    },
    {
        id: 2,
        nameAr: 'التراخيص والتصاريح',
        nameEn: 'Licenses & Permits',
        emoji: '📜',
        description: 'الحصول على التراخيص اللازمة',
    },
    {
        id: 3,
        nameAr: 'التمويل ورأس المال',
        nameEn: 'Funding & Capital',
        emoji: '💰',
        description: 'تأمين التمويل وإدارة رأس المال',
    },
    {
        id: 4,
        nameAr: 'التوظيف والسعودة',
        nameEn: 'Hiring & Saudization',
        emoji: '👥',
        description: 'بناء الفريق والالتزام بنظام نطاقات',
    },
    {
        id: 5,
        nameAr: 'الضرائب والزكاة',
        nameEn: 'Tax & Zakat',
        emoji: '🧾',
        description: 'الالتزام الضريبي والزكوي',
    },
    {
        id: 6,
        nameAr: 'التشغيل والتحديات',
        nameEn: 'Operations & Challenges',
        emoji: '⚙️',
        description: 'إدارة العمليات اليومية',
    },
    {
        id: 7,
        nameAr: 'الإطلاق والنمو',
        nameEn: 'Launch & Growth',
        emoji: '🚀',
        description: 'إطلاق المشروع والتوسع',
    }
];

// ============ HARDCODED CHOICES PER STAGE (fallback + used always) ============
// Each stage has a scenario message + 4 choices with consequences
function getStageData(stageNum) {
    const sector = GameState.sector;
    const name = GameState.playerName;
    const effects = GameState.statusEffects;
    const budget = GameState.budget;

    // Check for cascading consequences from previous choices
    const hasWrongEntity = effects.some(e => e.id === 'wrong_entity');
    const hasTaxPenalty = effects.some(e => e.id === 'tax_penalty');
    const hasRedNitaqat = effects.some(e => e.id === 'red_nitaqat');
    const hasGoodLicense = effects.some(e => e.id === 'fast_license');
    const hasBadFunding = effects.some(e => e.id === 'bad_funding');
    const hasGoodTeam = effects.some(e => e.id === 'good_team');
    const hasDebtTrap = effects.some(e => e.id === 'debt_trap');
    const hasBrandDamage = effects.some(e => e.id === 'brand_damage');

    const stages = {
        1: {
            scenario: `مرحباً بك يا ${name}! أنا كريم، مستشارك التنفيذي في عالم ريادة الأعمال.\n\nترغب في الاستثمار في قطاع **${sector}** بالمملكة العربية السعودية؟ الخطوة التأسيسية الأولى هي تسجيل الكيان القانوني واستخراج السجل التجاري.\n\nالسجل التجاري الموحد يتألف من 10 خانات تبدأ بالرقم 7 ويسري في كافة أنحاء المملكة. والسؤال الاستراتيجي الآن: **ما هو الشكل القانوني الذي ستختاره لمنشأتك؟**\n\nتذكر أن لكل خيار تبعات قانونية ومالية ومسؤوليات مباشرة...`,
            choices: [
                {
                    text: 'شركة ذات مسؤولية محدودة (ذ.م.م)',
                    hint: 'الخيار الأكثر حماية للذمة المالية واستقراراً',
                    quality: 'good',
                    score: 12,
                    budgetImpact: -15000,
                    reputationImpact: +5,
                    consequence: 'اختيار استراتيجي ممتاز! توفر الشركة ذات المسؤولية المحدودة فصلاً تاماً بين الذمة المالية الشخصية والتزامات الشركة.',
                    consequenceDetail: '-15,000 ر.س رسوم تأسيس | سمعة +5',
                    effects: [{ id: 'llc_entity', label: '🏢 شركة ذ.م.م', type: 'success' }],
                    removeEffects: [],
                },
                {
                    text: 'شركة مساهمة مبسطة (ش.م.ب)',
                    hint: 'مثالية لجذب المستثمرين ولكنها تتطلب تنظيماً أعلى',
                    quality: 'neutral',
                    score: 8,
                    budgetImpact: -25000,
                    reputationImpact: +3,
                    consequence: 'خيار طموح لجذب المستثمرين ورؤوس الأموال، غير أن إجراءاتها التنظيمية ومتطلبات حوكمتها تتطلب نفقات أعلى.',
                    consequenceDetail: '-25,000 ر.س رسوم | متطلبات إدارية أعلى',
                    effects: [{ id: 'sjsc_entity', label: '📊 شركة ش.م.ب', type: 'info' }],
                    removeEffects: [],
                },
                {
                    text: 'مؤسسة فردية بدون توثيق نظامي رسمي',
                    hint: 'منخفضة التكلفة ولكن بلا حماية قانونية للذمة المالية',
                    quality: 'bad',
                    score: 2,
                    budgetImpact: -2000,
                    reputationImpact: -15,
                    consequence: '⚠️ خطأ جسيم! بدون سجل تجاري نظامي، لن تتمكن من فتح حساب مصرفي تجاري مستقل أو إبرام عقود رسمية، وستواجه عقبات قانونية في المراحل اللاحقة!',
                    consequenceDetail: 'تعقيدات قانونية متوقعة | سمعة -15',
                    effects: [{ id: 'wrong_entity', label: '⚠️ بدون سجل تجاري نظامي', type: 'danger' }],
                    removeEffects: [],
                },
                {
                    text: 'فرع لشركة أجنبية بترخيص من وزارة الاستثمار (MISA)',
                    hint: 'إجراءات مطولة ومتطلبات رأس مال مرتفعة',
                    quality: 'neutral',
                    score: 6,
                    budgetImpact: -40000,
                    reputationImpact: +2,
                    consequence: 'إجراءات وزارة الاستثمار تتطلب وقتاً أطول ورسوماً استشارية مرتفعة، مما قد يؤخر انطلاق المشروع لعدة أشهر.',
                    consequenceDetail: '-40,000 ر.س | تأخير محتمل في استكمال التراخيص',
                    effects: [{ id: 'misa_delay', label: '🕐 إجراءات استثمار مطولة', type: 'warning' }],
                    removeEffects: [],
                }
            ]
        },
        2: {
            scenario: hasWrongEntity
                ? `يا ${name}، نواجه معضلة إدارية كبرى! نظراً لعدم وجود سجل تجاري نظامي، رفضت منصة "بلدي" إصدار رخصة النشاط التجاري.\n\nيتطلب العمل في قطاع **${sector}**:\n- رخصة بلدية فورية عبر منصة **بلدي**\n- شهادة سلامة من الدفاع المدني\n- التراخيص الفنية المتخصصة للقطاع\n\n**كيف ستعالج هذا الموقف النظامي على الفور؟**`
                : `أحسنت يا ${name}. حان الآن موعد استخراج التراخيص والتصاريح التشغيلية.\n\nيتطلب قطاع **${sector}** استيفاء الاشتراطات التالية:\n- رخصة النشاط التجاري عبر منصة **بلدي**\n- شهادة المطابقة والسلامة من الدفاع المدني\n- الموافقات التنظيمية الخاصة بالقطاع\n\nوردك إشعار رسمي من الأمانة يفيد بعدم مطابقة الموقع المختار لكود البناء واشتراطات السلامة! **ما هو قرارك؟**`,
            choices: [
                {
                    text: 'استئجار موقع جديد معتمد ومطابق لكافة المعايير النظامية',
                    hint: 'أعلى تكلفة لكنه يضمن صدور الرخصة الفورية',
                    quality: 'good',
                    score: 12,
                    budgetImpact: -30000,
                    reputationImpact: +8,
                    consequence: 'قرار إداري حكيم! الموقع الجديد مستوفٍ لكافة الاشتراطات وصدرت الرخصة التشغيلية في غضون أيام.',
                    consequenceDetail: '-30,000 ر.س نفقات موقع معتمد | صدور رخصة سريع',
                    effects: [{ id: 'fast_license', label: '✅ رخصة نظامية مكتملة', type: 'success' }],
                    removeEffects: ['wrong_entity'],
                },
                {
                    text: 'إجراء التعديلات الهندسية المطلوبة على المقر الحالي',
                    hint: 'أقل تكلفة لكنه يستهلك وقتاً إضافياً',
                    quality: 'neutral',
                    score: 8,
                    budgetImpact: -15000,
                    reputationImpact: 0,
                    consequence: 'استغرقت التعديلات شهراً كاملاً؛ ورغم تقليل النفقات إلا أن موعد التدشين قد تأخر.',
                    consequenceDetail: '-15,000 ر.س تعديلات | تأخير في الجدولة لمدة شهر',
                    effects: [{ id: 'delayed_license', label: '🕐 تأخير الترخيص', type: 'warning' }],
                    removeEffects: [],
                },
                {
                    text: 'بدء التشغيل دون رخصة نظامية وتأجيل استخراجها لاحقاً',
                    hint: 'مخاطرة رقابية كبرى وانتهاك مباشر للأنظمة',
                    quality: 'bad',
                    score: 1,
                    budgetImpact: 0,
                    reputationImpact: -20,
                    consequence: '🚨 كارثة رقابية! رصدت الفرق الميدانية التفتيشية ممارسة النشاط بلا ترخيص، وتم فرض غرامة 50,000 ريال وإغلاق المنشأة فوراً!',
                    consequenceDetail: 'غرامة -50,000 ر.س | سمعة -20 | إغلاق إداري للمنشأة',
                    effects: [{ id: 'no_license_penalty', label: '🚨 مخالفة تشغيلية جسيمة', type: 'danger' }],
                    removeEffects: [],
                    extraBudgetPenalty: -50000,
                },
                {
                    text: 'الاعتماد على مقر افتراضي مرخص وممارسة الأعمال رقمياً',
                    hint: 'حل مرن ومناسب للأنشطة التقنية والتجارية الحديثة',
                    quality: sector === 'تقنية' || sector === 'تجارة إلكترونية' ? 'good' : 'neutral',
                    score: sector === 'تقنية' || sector === 'تجارة إلكترونية' ? 10 : 5,
                    budgetImpact: -5000,
                    reputationImpact: sector === 'تقنية' || sector === 'تجارة إلكترونية' ? +3 : -5,
                    consequence: sector === 'تقنية' || sector === 'تجارة إلكترونية'
                        ? 'إجراء ذكي وفعال! طبيعة نشاطك تسمح بالعمل عن بعد، ووفرت نفقات رأسمالية كبرى.'
                        : 'قطاع ' + sector + ' يتطلب وجود مقر مادي فعلي لمعاينة النشاط، ولن يفي المقر الافتراضي بكافة الشروط.',
                    consequenceDetail: sector === 'تقنية' || sector === 'تجارة إلكترونية'
                        ? '-5,000 ر.س فقط | توفير مالي كبير'
                        : '-5,000 ر.س | حاجة ملحة لمقر فعلي لاحقاً',
                    effects: [{ id: 'virtual_office', label: '💻 مقر افتراضي', type: 'info' }],
                    removeEffects: [],
                }
            ]
        },
        3: {
            scenario: hasWrongEntity
                ? `يا ${name}! نظراً لعدم استكمال السجل التجاري النظامي، **رفضت المؤسسات المصرفية فتح حساب بنكي تجاري** للشركة!\n\nرصيدك المالي المتاح: **${formatCurrency(budget)}**.\n\nيتعين عليك الآن إيجاد حل تمويلي عاجل وسليم. **كيف ستدير تدفقاتك المالية؟**`
                : `يا ${name}! حان الوقت لبحث إدارة رأس المال والتمويل.\n\nميزانيتك الحالية المتاحة: **${formatCurrency(budget)}**.\n\nأمامك عدة خيارات لتأمين السيولة اللازمة للنمو، ولكل مسار تكلفته الاستراتيجية. **ما هي استراتيجيتك لتأمين التمويل؟**`,
            choices: [
                {
                    text: 'التقدم للحصول على تمويل تنموي من بنك التنمية الاجتماعية',
                    hint: 'تمويل حكومي ميسر بلا فوائد يتطلب دراسة جدوى متكاملة',
                    quality: 'good',
                    score: 13,
                    budgetImpact: +200000,
                    reputationImpact: +5,
                    consequence: 'إنجاز رائع! وافقت لجان التمويل على منحك 200,000 ريال كتمويل ميسر بدون فوائد بعد اجتياز تقييم الجدوى.',
                    consequenceDetail: '+200,000 ر.س تمويل تنموي ميسر | سمعة +5',
                    effects: [{ id: 'sdb_loan', label: '🏦 تمويل تنموي ميسر', type: 'success' }],
                    removeEffects: [],
                },
                {
                    text: 'إدخال مستثمر ملائكي شريكاً في حصة من رأس المال',
                    hint: 'سيولة عالية مع التنازل عن نسبة من الملكية والقرارات',
                    quality: 'neutral',
                    score: 9,
                    budgetImpact: +350000,
                    reputationImpact: +3,
                    consequence: 'وافق المستثمر على ضخ 350,000 ريال مقابل الاستحواذ على 35% من حصص الشركة. سيولة ممتازة ولكن مع تقليص سيطرتك.',
                    consequenceDetail: '+350,000 ر.س سيولة | تنازل عن 35% من الملكية',
                    effects: [{ id: 'angel_investor', label: '👼 شريك استثماري (35%)', type: 'warning' }],
                    removeEffects: [],
                },
                {
                    text: 'الحصول على تمويل مصرفي شخصي بفوائد تجارية مرتفعة',
                    hint: 'إجراء سريع لكن الفوائد التراكمية تستنزف الأرباح',
                    quality: 'bad',
                    score: 4,
                    budgetImpact: +150000,
                    reputationImpact: -5,
                    consequence: '⚠️ فخ الديون! الفائدة المصرفية البالغة 12% سنوياً تفرض أقساطاً باهظة تستنزف السيولة التشغيلية شهرياً.',
                    consequenceDetail: '+150,000 ر.س | فوائد 12% سنوياً | عبء تمويلي خانق',
                    effects: [{ id: 'debt_trap', label: '💳 التزامات ديون مرتفعة', type: 'danger' }],
                    removeEffects: [],
                },
                {
                    text: 'الاكتفاء بالسيولة الذاتية الحالية والبدء بنطاق محدود',
                    hint: 'مسار آمن مالياً ولكن وتيرة التوسع ستكون شديدة البطء',
                    quality: budget > 300000 ? 'neutral' : 'bad',
                    score: budget > 300000 ? 7 : 3,
                    budgetImpact: 0,
                    reputationImpact: budget > 300000 ? 0 : -8,
                    consequence: budget > 300000
                        ? 'قرار تحفظي متزن. الميزانية كافية للانطلاقة المبدئية، وإن كان النمو سيتطلب وقتاً أطول.'
                        : '⚠️ السيولة المتاحة منخفضة وحرجة للغاية! ستواجه اختناقات حادة في التوظيف والتشغيل.',
                    consequenceDetail: budget > 300000 ? 'لا تغيير في السيولة | نمو تدريجي بطيء' : 'ميزانية تشغيلية منخفضة ومهددة',
                    effects: budget > 300000
                        ? [{ id: 'bootstrap', label: '🐢 تمويل ذاتي بطيء', type: 'info' }]
                        : [{ id: 'bad_funding', label: '🔴 سيولة نقدية حرجة', type: 'danger' }],
                    removeEffects: [],
                }
            ]
        },
        4: {
            scenario: hasRedNitaqat || hasBadFunding
                ? `يا ${name}! الموقف يتطلب إدارة حازمة...\n\n${hasBadFunding ? 'شح السيولة يقيد قدرتك على استقطاب الكفاءات الاحترافية.' : ''}\n\nيفرض نظام **نطاقات** نسب توطين إلزامية على قطاع **${sector}**، بحد أدنى للأجور قدره **4,000 ريال** شهرياً لاحتساب الموظف في نسبة التوطين.\n\nتحتاج الشركة إلى كادر بشري أساسي لبدء العمليات. **ما هي خطتك لبناء فريق العمل؟**`
                : `يا ${name}! حان موعد تأسيس الفريق واستقطاب الكفاءات!\n\nيفرض نظام **نطاقات** الصادر عن وزارة الموارد البشرية نسب توطين إلزامية على قطاع **${sector}**، مع اشتراط حد أدنى قدره **4,000 ريال** شهرياً لاحتساب الموظف في النسبة.\n\nعدم الالتزام بالنسب المقررة يهبط بالمنشأة إلى النطاق الأحمر ويوقف خدمات التأشيرات والعمل! **كيف ستبني فريقك؟**`,
            choices: [
                {
                    text: 'استقطاب كفاءات وطنية متمرسة برواتب ومزايا تنافسية',
                    hint: 'استثمار أعلى تكلفة لكنه يضمن أعلى إنتاجية والنطاق البلاتيني',
                    quality: 'good',
                    score: 14,
                    budgetImpact: -60000,
                    reputationImpact: +10,
                    consequence: 'فريق عمل استثنائي! رفعت الكفاءات الوطنية من جودة الأداء وصعدت الشركة فوراً إلى النطاق البلاتيني.',
                    consequenceDetail: '-60,000 ر.س رواتب 3 أشهر | تصنيف نطاق بلاتيني',
                    effects: [{ id: 'good_team', label: '⭐ نطاق بلاتيني متميز', type: 'success' }],
                    removeEffects: ['red_nitaqat', 'bad_funding'],
                },
                {
                    text: 'توظيف خريجين جامعيين جدد والاستثمار في تدريبهم',
                    hint: 'تكلفة معتدلة وتأهيل تدريجي مع انخفاض الإنتاجية الأولية',
                    quality: 'neutral',
                    score: 9,
                    budgetImpact: -30000,
                    reputationImpact: +5,
                    consequence: 'خيار اقتصادي واعد؛ الخريجون يتمتعون بالحماس لكنهم بحاجة لفترة تأهيل تمتد 3 أشهر لبلوغ الكفاءة المستهدفة.',
                    consequenceDetail: '-30,000 ر.س | فترة تدريب وتأهيل 3 أشهر',
                    effects: [{ id: 'training_team', label: '📚 كادر قيد التأهيل', type: 'info' }],
                    removeEffects: [],
                },
                {
                    text: 'الاعتماد على عمالة وافدة منخفضة الأجر وتجاهل التوطين',
                    hint: 'مخالفة نظامية صريحة تعرض المنشأة للإيقاف والعقوبات',
                    quality: 'bad',
                    score: 1,
                    budgetImpact: -15000,
                    reputationImpact: -25,
                    consequence: '🚨 عقوبة نظامية صارمة! صنفت وزارة الموارد البشرية المنشأة في النطاق الأحمر وتم إيقاف خدمات نقل الكفالة والتأشيرات مع غرامة 20,000 ريال!',
                    consequenceDetail: 'غرامة -20,000 ر.س | نطاق أحمر | إيقاف خدمات العمل',
                    effects: [{ id: 'red_nitaqat', label: '🔴 تصنيف نطاق أحمر', type: 'danger' }],
                    removeEffects: [],
                    extraBudgetPenalty: -20000,
                },
                {
                    text: 'التعاقد مع مستقلين عبر منصات العمل الحر المعتمدة',
                    hint: 'مرونة تشغيلية عالية ولكنها لا تحتسب في نسب نطاقات',
                    quality: 'neutral',
                    score: 6,
                    budgetImpact: -10000,
                    reputationImpact: -3,
                    consequence: 'يوفر المستقلون مرونة جيدة، لكنهم لا يُحتسبون ضمن نسب التوطين! يلزمك تعيين موظف سعودي بدوام كامل لتفادي انخفاض النطاق.',
                    consequenceDetail: '-10,000 ر.س | عدم تحقيق نسبة التوطين المطلوبة',
                    effects: [{ id: 'freelance_risk', label: '⚠️ عجز في نسبة التوطين', type: 'warning' }],
                    removeEffects: [],
                }
            ]
        },
        5: {
            scenario: hasDebtTrap
                ? `يا ${name}! نظراً لوجود **التزامات ديون مرتفعة**، تخضع السجلات المالية لرقابة دقيقة من هيئة الزكاة والضريبة والجمارك (ZATCA)!\n\nالمتطلبات النظامية الإلزامية:\n- التسجيل في ضريبة القيمة المضافة بنسبة **15%**\n- منظومة الفوترة الإلكترونية المعتمدة (**فاتورة**)\n- الإقرار الزكوي السنوي بنسبة **2.5%**\n\nتلقيت إشعاراً نهائياً: **انتهاء مهلة التسجيل الضريبي بعد أسبوع واحد!** ما هو تصرفك؟`
                : `يا ${name}! حان موعد الامتثال المالي مع **هيئة الزكاة والضريبة والجمارك (ZATCA)**!\n\nالمتطلبات النظامية الإلزامية:\n- التسجيل في ضريبة القيمة المضافة بنسبة **15%** (إلزامي إذا تجاوزت الإيرادات 375,000 ريال)\n- الربط مع منظومة الفوترة الإلكترونية (**فاتورة**)\n- الإقرار وسداد الزكاة الشرعية بنسبة **2.5%** على الوعاء الزكوي\n\nتلقيت إشعاراً رسمياً بوجوب استكمال الربط الضريبي خلال أسبوع واحد! **ما هو قرارك؟**`,
            choices: [
                {
                    text: 'الاشتراك الفوري في نظام فوترة سحابي معتمد ومربوط مع ZATCA',
                    hint: 'الخيار المؤسسي الأمثل - امتثال تقني وقانوني كامل',
                    quality: 'good',
                    score: 14,
                    budgetImpact: -12000,
                    reputationImpact: +10,
                    consequence: 'امتثال مؤسسي نموذجي! تم الربط بنجاح مع منصة "فاتورة" وتفعيل الإقرارات الضريبية والزكوية باحترافية.',
                    consequenceDetail: '-12,000 ر.س نظام فوترة معتمد | امتثال نظامي كامل',
                    effects: [{ id: 'tax_compliant', label: '✅ امتثال زكوي وضريبي', type: 'success' }],
                    removeEffects: ['tax_penalty'],
                },
                {
                    text: 'استخدام برامج الجداول الإلكترونية البسيطة بدلاً من النظام المعتمد',
                    hint: 'منخفض التكلفة لكنه مخالف لاشتراطات الربط والتكامل',
                    quality: 'neutral',
                    score: 6,
                    budgetImpact: -2000,
                    reputationImpact: -5,
                    consequence: '⚠️ مخالفة للمعايير الفنية! ملفات الجداول لا تدعم التشفير المعتمد من هيئة ZATCA، وتم منحك مهلة تصحيح لمدة 30 يوماً.',
                    consequenceDetail: '-2,000 ر.س | مهلة تصحيح 30 يوماً | خطر فرض غرامة',
                    effects: [{ id: 'fatoora_warning', label: '⚠️ إنذار فوترة إلكترونية', type: 'warning' }],
                    removeEffects: [],
                },
                {
                    text: 'تجاهل الإشعار وتأجيل التسجيل للتركيز على المبيعات',
                    hint: 'إهمال جسيم يعاقب عليه النظام بغرامات وإيقاف فوري',
                    quality: 'bad',
                    score: 0,
                    budgetImpact: -50000,
                    reputationImpact: -20,
                    consequence: '🚨 غرامة مالية قاسية قدرها 50,000 ريال من هيئة الزكاة والضريبة نتيجة التخلف عن التسجيل، مع تجميد السجل والخدمات الحكومية!',
                    consequenceDetail: 'غرامة -50,000 ر.س | إيقاف الخدمات الحكومية | سمعة -20',
                    effects: [{ id: 'tax_penalty', label: '🚨 غرامة عدم امتثال ضريبي', type: 'danger' }],
                    removeEffects: [],
                },
                {
                    text: 'التعاقد مع مكتب محاسب قانوني معتمد لإدارة الملف الضريبي بالكامل',
                    hint: 'استثمار مهني يضمن دقة الإقرارات والتخطيط المالي السليم',
                    quality: 'good',
                    score: 11,
                    budgetImpact: -25000,
                    reputationImpact: +7,
                    consequence: 'استثمار نوعي ممتاز! تولى المحاسب القانوني تدقيق الميزانيات والربط مع منظومة فاتورة والتخطيط الزكوي باقتدار.',
                    consequenceDetail: '-25,000 ر.س أتعاب سنوية | تدقيق وإدارة ضريبية متكاملة',
                    effects: [{ id: 'accountant', label: '📊 محاسب قانوني معتمد', type: 'success' }],
                    removeEffects: ['tax_penalty'],
                }
            ]
        },
        6: {
            scenario: (() => {
                let intro = `يا ${name}! انطلقت العمليات التشغيلية في قطاع **${sector}** `;
                const warnings = [];
                if (hasRedNitaqat) warnings.push('وسط تداعيات تصنيف النطاق الأحمر');
                if (hasTaxPenalty) warnings.push('واستنزاف الغرامات الضريبية للسيولة');
                if (hasDebtTrap) warnings.push('وأعباء أقساط الديون المصرفية المرهقة');
                if (hasBrandDamage) warnings.push('وتأثر السمعة المؤسسية سلباً');

                if (warnings.length > 0) {
                    intro += '**' + warnings.join('، ') + '**.\n\n';
                } else {
                    intro += 'بثبات وكفاءة تشغيلية ممتازة! 💪\n\n';
                }

                intro += `مفاجأة سوقية غير متوقعة: **منافس تجاري رئيسي** دخل السوق مستهدفاً نفس شريحتك بأسعار أقل بنسبة 30% مع حملة إعلانية ضخمة! بدأ العملاء في المقارنة والتردد...\n\n**ما هي استراتيجيتك التنافسية للتصدي له؟**`;
                return intro;
            })(),
            choices: [
                {
                    text: 'التركيز على التميز والجودة وتطوير خدمة العملاء وبناء الولاء',
                    hint: 'استراتيجية التمايز المؤسسي المستدام على المدى البعيد',
                    quality: 'good',
                    score: 13,
                    budgetImpact: -20000,
                    reputationImpact: +12,
                    consequence: 'استراتيجية تسويقية بارعة! حافظ العملاء الواعون على ولائهم لعلامتك، واجتذبت المنشأة شريحة جديدة تثمن الجودة.',
                    consequenceDetail: '-20,000 ر.س تحسينات نوعية | سمعة +12 | تعزيز ولاء العملاء',
                    effects: [{ id: 'quality_brand', label: '⭐ علامة تجارية رائدة', type: 'success' }],
                    removeEffects: ['brand_damage'],
                },
                {
                    text: 'خفض الأسعار فوراً لمستوى أقل من المنافس - حرب أسعار شاملة!',
                    hint: 'استراتيجية استنزاف بالغة الخطورة تحرق هوامش الربح',
                    quality: 'bad',
                    score: 3,
                    budgetImpact: -80000,
                    reputationImpact: -10,
                    consequence: '💸 استنزاف مالي حاد! خسرت 80,000 ريال في حرب أسعار غير متكافئة، والمنافس يمتلك ملاءة مالية أكبر، مما قوض ربحيتك.',
                    consequenceDetail: '-80,000 ر.س خسائر تشغيلية | سمعة -10 | هوامش سالبة',
                    effects: [{ id: 'price_war_loss', label: '📉 خسائر حرب الأسعار', type: 'danger' }],
                    removeEffects: [],
                },
                {
                    text: 'ابتكار حزمة منتجات وخدمات حصرية ذات قيمة مضافة لا يمتلكها المنافس',
                    hint: 'إبداع تسويقي يستهدف خلق ميزة تنافسية فريدة',
                    quality: 'good',
                    score: 11,
                    budgetImpact: -35000,
                    reputationImpact: +8,
                    consequence: 'نجاح ابتكاري باهر! استطاعت الخدمات الجديدة التميز في السوق وفتحت قنوات إيرادات إضافية للشركة.',
                    consequenceDetail: '-35,000 ر.س تطوير وابتكار | ميزة تنافسية حصرية',
                    effects: [{ id: 'innovation', label: '💡 ابتكار وتمايز نوعي', type: 'success' }],
                    removeEffects: [],
                },
                {
                    text: 'تقديم شكوى رسمية إلى الهيئة العامة للمنافسة بدعوى ممارسات الإغراق',
                    hint: 'مسار قانوني يتطلب إثباتات مادية معقدة وقد يطول أمده',
                    quality: 'neutral',
                    score: 5,
                    budgetImpact: -5000,
                    reputationImpact: -5,
                    consequence: 'أوضحت الهيئة أن المنافسة سعرية مشروعة ولا تشكل إغراقاً نظامياً؛ وقد استنزف الإجراء بعض الوقت والسيولة.',
                    consequenceDetail: '-5,000 ر.س استشارات قانونية | سمعة -5 | عدم قبول الشكوى',
                    effects: [{ id: 'brand_damage', label: '😬 انطباع سلبي في السوق', type: 'warning' }],
                    removeEffects: [],
                }
            ]
        },
        7: {
            scenario: (() => {
                const score = GameState.score;
                const rep = GameState.reputation;
                let intro = `يا ${name}! وصلنا إلى المرحلة المصيرية: **محطة الإطلاق الرسمي والتوسع الكبير!** 🚀\n\n`;

                intro += `**المؤشرات التراكمية الحالية للمشروع:**\n`;
                intro += `- السيولة المتبقية: **${formatCurrency(GameState.budget)}**\n`;
                intro += `- مؤشر السمعة المؤسسية: **${rep}/100**\n`;
                intro += `- رصيد النقاط الاستراتيجية: **${score}**\n`;

                if (GameState.statusEffects.length > 0) {
                    intro += `- التأثيرات القائمة: ${GameState.statusEffects.map(e => e.label).join(' | ')}\n`;
                }

                intro += `\nفي هذه اللحظة الحاسمة، **تلقيت عرض استحواذ نقدي مغرٍ من مجموعة استثمارية كبرى** لشراء كامل أسهم مشروعك!\n\n**ما هو قرارك الاستراتيجي النهائي؟**`;
                return intro;
            })(),
            choices: [
                {
                    text: 'رفض الاستحواذ وتدشين المشروع رسمياً ككيان تجاري مستقل!',
                    hint: 'المسار الأكثر تحدياً واحتفاظاً بملكية العلامة التجارية',
                    quality: GameState.reputation >= 50 && GameState.budget > 100000 ? 'good' : 'neutral',
                    score: GameState.reputation >= 50 ? 14 : 7,
                    budgetImpact: -50000,
                    reputationImpact: +15,
                    consequence: GameState.reputation >= 50 && GameState.budget > 100000
                        ? '🎉 إنجاز استثنائي عظيم! انطلق المشروع بنجاح باهر في السوق وحصدت ثمار القرارات الاستراتيجية الصائبة!'
                        : '⚠️ تم إطلاق المشروع، لكن التحديات التشغيلية الناتجة عن قرارات سابقة تستلزم بذل جهود مضاعفة للاستقرار.',
                    consequenceDetail: '-50,000 ر.س تكاليف التدشين والتسويق',
                    effects: [{ id: 'launched', label: '🚀 تدشين رسمي ناجح!', type: 'success' }],
                    removeEffects: [],
                },
                {
                    text: 'قبول عرض الاستحواذ النقدي الكامل والتخارج المبكر بأرباح فورية',
                    hint: 'مكسب مالي مؤكد مع التخلي التام عن قيادة المشروع',
                    quality: 'neutral',
                    score: 8,
                    budgetImpact: +GameState.budget,
                    reputationImpact: 0,
                    consequence: 'أتممت صفقة تخارج مربحة نقدياً، لكنك تخليت عن طموح بناء صرح تجاري عملاق يحمل اسمك.',
                    consequenceDetail: `+${formatCurrency(GameState.budget)} أرباح تخارج | تنازل كامل عن الشركة`,
                    effects: [{ id: 'acquisition', label: '💼 تخارج استثماري نقدي', type: 'info' }],
                    removeEffects: [],
                },
                {
                    text: 'التفاوض لتحويل العرض إلى شراكة استراتيجية وتوسعية مع احتفاظك بالإدارة التنفيذية',
                    hint: 'الجمع الحكيم بين السيولة الاستثمارية والسيطرة القيادية',
                    quality: 'good',
                    score: 13,
                    budgetImpact: +100000,
                    reputationImpact: +10,
                    consequence: 'مناورة تفاوضية ممتازة! أمنّت الشراكة الاستراتيجية سيولة هائلة وخبرات نوعية مع بقائك رئيساً تنفيذياً وموجهاً للمشروع.',
                    consequenceDetail: '+100,000 ر.س دعم استثماري توسعي | شراكة قوية',
                    effects: [{ id: 'strategic_partner', label: '🤝 تحالف استثماري استراتيجي', type: 'success' }],
                    removeEffects: [],
                },
                {
                    text: 'التردد وتأجيل قرار الإطلاق لمزيد من المراجعة والترقب',
                    hint: 'التباطؤ في بيئة الأعمال التنافسية يضيع الفرص الثمينة',
                    quality: 'bad',
                    score: 2,
                    budgetImpact: -30000,
                    reputationImpact: -15,
                    consequence: '😔 ضياع الفرصة التنافسية! السوق لا ينتظر المترددين؛ وقد استغل المنافسون غيابك للاستحواذ على الحصة السوقية واهتزت ثقة المستثمرين.',
                    consequenceDetail: '-30,000 ر.س مصروفات إضافية | فقدان الميزة التنافسية',
                    effects: [{ id: 'missed_opportunity', label: '😔 فرصة سوقية ضائعة', type: 'danger' }],
                    removeEffects: [],
                }
            ]
        }
    };

    return stages[stageNum];
}

// ============ DEFAULT SCENARIOS ============
const DEFAULT_SCENARIOS = {
    'تقنية': { businessModel: 'تطبيق توصيل ذكي بالدرونز', budget: 500000 },
    'تجارة إلكترونية': { businessModel: 'متجر إلكتروني للمنتجات التراثية', budget: 300000 },
    'مطاعم وضيافة': { businessModel: 'سلسلة مطاعم أكل حجازي صحي', budget: 800000 },
    'عقارات': { businessModel: 'منصة إدارة عقارات بالذكاء الاصطناعي', budget: 1000000 },
    'صحة وطب': { businessModel: 'عيادة طب عن بعد للصحة النفسية', budget: 600000 },
    'تعليم وتدريب': { businessModel: 'منصة تدريب مهني بالواقع الافتراضي', budget: 400000 },
    'لوجستيات': { businessModel: 'شركة شحن ميل أخير للأدوية', budget: 700000 },
    'ترفيه وسياحة': { businessModel: 'شركة تجارب سياحية في العلا', budget: 900000 },
};

// ============ ATTITUDE ============
const ATTITUDE_LABELS = { 1: 'متساهل جداً', 2: 'متساهل', 3: 'متوسط', 4: 'صارم', 5: 'صارم جداً' };

// ============ PARTICLES ============
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.3 + 0.1;
            this.golden = Math.random() > 0.7;
        }
        update() {
            this.x += this.speedX; this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.golden ? `rgba(0, 122, 112, ${this.opacity * 0.2})` : `rgba(0, 168, 150, ${this.opacity * 0.14})`;
            ctx.fill();
        }
    }
    for (let i = 0; i < 80; i++) particles.push(new Particle());
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// ============ SCREEN MANAGEMENT ============
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ============ SETUP ============
function selectSector(element) {
    document.querySelectorAll('.sector-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    GameState.sector = element.dataset.sector;
}

document.getElementById('attitude-slider').addEventListener('input', function() {
    const val = parseInt(this.value);
    GameState.attitude = val;
    document.getElementById('attitude-value').textContent = ATTITUDE_LABELS[val];
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        GameState.businessModelText = e.target.result;
        GameState.businessModel = file.name;
        document.getElementById('upload-area').classList.add('has-file');
        document.getElementById('upload-status').textContent = `✅ تم رفع: ${file.name}`;
    };
    reader.readAsText(file);
}

// ============ LAUNCH ============
function launchGame() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { shakeElement(document.getElementById('player-name')); return; }
    if (!GameState.sector) { shakeElement(document.getElementById('sector-grid')); return; }

    GameState.playerName = name;
    GameState.voiceEnabled = document.getElementById('voice-toggle').checked;

    if (!GameState.businessModelText && DEFAULT_SCENARIOS[GameState.sector]) {
        GameState.budget = DEFAULT_SCENARIOS[GameState.sector].budget;
        GameState.businessModelText = DEFAULT_SCENARIOS[GameState.sector].businessModel;
    }

    document.getElementById('hud-player-name').textContent = GameState.playerName;
    document.getElementById('hud-sector').textContent = GameState.sector;
    document.getElementById('hud-budget').textContent = formatCurrency(GameState.budget);
    document.getElementById('hud-score').textContent = '0';
    updateReputationBar();

    GameState.gameStartTime = new Date();
    GameState.currentStage = 0;

    unlockAudio();

    showScreen('screen-game');
    if (typeof Avatar3D !== 'undefined') {
        Avatar3D.resize();
    }
    startStage(1);
}

function shakeElement(el) {
    el.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => { el.style.animation = ''; }, 500);
}

// ============ GAME ENGINE ============
async function startStage(stageNum) {
    if (stageNum > CONFIG.TOTAL_STAGES) { endGame(); return; }

    stopVoice();
    stopTimer();

    GameState.currentStage = stageNum;
    const stage = STAGES[stageNum - 1];

    document.getElementById('stage-number').textContent = stageNum;
    document.getElementById('stage-name').textContent = stage.nameAr;
    updateProgressBar(stageNum);

    // Get stage data (choices depend on past decisions)
    const stageData = getStageData(stageNum);

    // AI commentary on the scenario (optional enhancement via Groq)
    let scenarioText = stageData.scenario;

    // Try to get AI-enhanced scenario that references past decisions
    if (GameState.decisionLog.length > 0) {
        try {
            showLoading(true);
            const aiScenario = await getAIScenarioCommentary(stageNum, stageData);
            if (aiScenario) scenarioText = aiScenario;
            showLoading(false);
        } catch (e) {
            showLoading(false);
            // Use fallback scenario text
        }
    }

    addMessage('ai', scenarioText);

    // Show choices so player can review them while listening
    showChoices(stageData.choices);

    if (GameState.voiceEnabled) {
        // Show "reading" state on the timer while agent speaks
        const timerContainer = document.getElementById('timer-container');
        const timerText = document.getElementById('timer-text');
        const timerFill = document.getElementById('timer-fill');
        timerContainer.style.display = 'block';
        timerFill.style.width = '100%';
        timerText.textContent = '🎙️ يتحدث المستشار...';
        timerText.classList.add('reading');
        timerText.classList.remove('urgent');

        const played = await playVoice(scenarioText);

        // If voice failed to play or was aborted, give a brief 3s reading buffer before countdown
        if (!played && GameState.isWaitingForInput && !GameState.isProcessing) {
            timerText.textContent = '📖 اقرأ الموقف ثم اختر...';
            await new Promise(r => setTimeout(r, 3000));
        }

        // Remove reading state
        timerText.classList.remove('reading');
        timerContainer.style.display = 'none';
    }

    // Only start timer countdown after the agent finishes reading the message & question!
    if (GameState.isWaitingForInput && !GameState.isProcessing) {
        startTimer();
    }
}

async function getAIScenarioCommentary(stageNum, stageData) {
    const stage = STAGES[stageNum - 1];
    const pastDecisions = GameState.decisionLog.map(d => 
        `المرحلة ${d.stage}: اختار "${d.choiceText}" → ${d.consequence}`
    ).join('\n');

    const activeEffects = GameState.statusEffects.map(e => e.label).join('، ');

    const prompt = `أنت "كريم"، المستشار التنفيذي والخبير الاستراتيجي لرواد الأعمال في المملكة العربية السعودية.
تتحدث وتكتب باللغة العربية الفصحى السليمة والواضحة والمهنية تماماً وبنبرة قيادية حازمة وواقعية (ممنوع منعاً باتاً استخدام أي لهجة عامية).

رائد الأعمال: ${GameState.playerName}
القطاع: ${GameState.sector}
السيولة المتاحة: ${formatCurrency(GameState.budget)}
السمعة المؤسسية: ${GameState.reputation}/100
التأثيرات القائمة: ${activeEffects || 'لا توجد'}

القرارات السابقة وتداعياتها:
${pastDecisions || 'المرحلة التأسيسية الأولى'}

المرحلة الحالية: ${stage.nameAr} (${stageNum}/${CONFIG.TOTAL_STAGES})

السيناريو الأساسي:
${stageData.scenario}

المطلوب:
أعد صياغة السيناريو باللغة العربية الفصحى الصريحة والواضحة:
1. اذكر قرارات اللاعب السابقة وعواقبها المباشرة على وضعه الحالي.
2. وجه خطابك إليه مباشرة بأسلوب تنفيذي مهني حازم.
3. اطرح الموقف التحدي والتساؤل النهائي بوضوح شديد.
4. لا تذكر الخيارات الأربعة - فقط اعرض الموقف والسؤال.
5. الإيجاز: أقل من 100 كلمة، وباللغة العربية الفصحى حصراً.
6. مستوى الحزم والصرامة: ${GameState.attitude}/5.`;

    const response = await fetch(CONFIG.GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: 'اكتب السيناريو' }
            ],
            model: CONFIG.GROQ_MODEL,
            temperature: 0.85,
            max_tokens: 400,
        })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content;
}

// ============ CHOICES UI ============
function showChoices(choices) {
    const container = document.getElementById('choices-container');
    const grid = document.getElementById('choices-grid');
    grid.innerHTML = '';

    const letters = ['أ', 'ب', 'ج', 'د'];

    choices.forEach((choice, index) => {
        const card = document.createElement('div');
        card.className = 'choice-card';
        card.dataset.index = index;
        card.innerHTML = `
            <div class="choice-letter">${letters[index]}</div>
            <div class="choice-content">
                <div class="choice-text">${choice.text}</div>
                <div class="choice-hint">${choice.hint}</div>
                <div class="choice-impact" id="impact-${index}">
                    <!-- Revealed after selection -->
                </div>
            </div>
        `;
        card.addEventListener('click', () => selectChoice(index, choices));
        grid.appendChild(card);
    });

    container.style.display = 'block';
    GameState.isWaitingForInput = true;
}

function hideChoices() {
    document.getElementById('choices-container').style.display = 'none';
    GameState.isWaitingForInput = false;
}

async function selectChoice(index, choices) {
    if (GameState.isProcessing) return;
    GameState.isProcessing = true;

    stopVoice();
    stopTimer();
    const choice = choices[index];

    // 3D Avatar reaction to choice
    if (typeof Avatar3D !== 'undefined') {
        Avatar3D.reactToChoice(choice.quality);
    }

    // Disable all cards and highlight selected
    const cards = document.querySelectorAll('.choice-card');
    cards.forEach(c => c.classList.add('disabled'));

    const selectedCard = cards[index];
    const qualityClass = choice.quality === 'good' ? 'selected-good'
        : choice.quality === 'bad' ? 'selected-bad' : 'selected-neutral';
    selectedCard.classList.remove('disabled');
    selectedCard.classList.add(qualityClass);

    // Show impact tags
    const impactDiv = document.getElementById(`impact-${index}`);
    let impactHTML = '';
    if (choice.budgetImpact !== 0) {
        const cls = choice.budgetImpact > 0 ? 'positive' : 'negative';
        impactHTML += `<span class="impact-tag ${cls}">${choice.budgetImpact > 0 ? '+' : ''}${formatCurrency(choice.budgetImpact)}</span>`;
    }
    if (choice.reputationImpact !== 0) {
        const cls = choice.reputationImpact > 0 ? 'positive' : 'negative';
        impactHTML += `<span class="impact-tag ${cls}">سمعة ${choice.reputationImpact > 0 ? '+' : ''}${choice.reputationImpact}</span>`;
    }
    if (choice.score > 10) {
        impactHTML += `<span class="impact-tag positive">+${choice.score} نقاط</span>`;
    } else if (choice.score < 5) {
        impactHTML += `<span class="impact-tag negative">+${choice.score} نقاط فقط</span>`;
    } else {
        impactHTML += `<span class="impact-tag neutral">+${choice.score} نقاط</span>`;
    }
    impactDiv.innerHTML = impactHTML;

    // Add player message
    addMessage('player', choice.text);

    // Apply consequences
    await applyConsequences(choice);

    // Log the decision
    GameState.decisionLog.push({
        stage: GameState.currentStage,
        stageName: STAGES[GameState.currentStage - 1].nameAr,
        choiceIndex: index,
        choiceText: choice.text,
        quality: choice.quality,
        score: choice.score,
        budgetImpact: choice.budgetImpact + (choice.extraBudgetPenalty || 0),
        reputationImpact: choice.reputationImpact,
        consequence: choice.consequence,
        timeUsed: CONFIG.TIMER_DURATION - GameState.timeRemaining,
    });

    // Save stage result
    GameState.stageResults.push({
        stage: GameState.currentStage,
        stageName: STAGES[GameState.currentStage - 1].nameAr,
        choiceText: choice.text,
        quality: choice.quality,
        score: choice.score,
        consequence: choice.consequence,
    });

    // Wait then get AI feedback and advance
    await new Promise(r => setTimeout(r, 1500));

    hideChoices();

    // AI feedback on the choice
    addTypingIndicator();
    let feedbackText = choice.consequence;
    try {
        const aiFeedback = await getAIFeedback(choice);
        if (aiFeedback) feedbackText = aiFeedback;
    } catch (e) { /* use fallback */ }
    removeTypingIndicator();

    addMessage('ai', feedbackText);
    if (GameState.voiceEnabled) await playVoice(feedbackText);

    GameState.isProcessing = false;

    // Advance to next stage
    setTimeout(() => {
        if (GameState.currentStage < CONFIG.TOTAL_STAGES) {
            startStage(GameState.currentStage + 1);
        } else {
            endGame();
        }
    }, 1500);
}

async function getAIFeedback(choice) {
    const prompt = `أنت المستشار التنفيذي "كريم". رائد الأعمال "${GameState.playerName}" اتخذ القرار التالي: "${choice.text}".

تقييم القرار: كان هذا القرار ${choice.quality === 'good' ? 'صائباً واستراتيجياً' : choice.quality === 'bad' ? 'خاطئاً ومحفوفاً بالمخاطر' : 'متوسطاً ومقبولاً'}.

الأثر المباشر: ${choice.consequence}

المطلوب:
علّق على قراره في جملتين إلى ثلاث جمل باللغة العربية الفصحى السليمة والواضحة تماماً:
- خاطب اللاعب باسمه بنبرة مهنية وتنفيذية واقعية (ممنوع استخدام اللهجة العامية إطلاقاً).
- إذا كان القرار سلبياً، وجّه إليه نقداً حازماً ومباشراً، وإن كان إيجابياً، أثنِ على فكره الاستراتيجي.
- لا تتجاوز 45 كلمة، واستخدم فصحى نقية وسلسة يسهل نطقها صوتياً.
- مستوى الصرامة: ${GameState.attitude}/5.`;

    const response = await fetch(CONFIG.GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            messages: [{ role: 'system', content: prompt }, { role: 'user', content: 'علّق' }],
            model: CONFIG.GROQ_MODEL,
            temperature: 0.9,
            max_tokens: 200,
        })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content;
}

// ============ CONSEQUENCES ENGINE ============
async function applyConsequences(choice) {
    // Apply budget
    let totalBudgetImpact = choice.budgetImpact + (choice.extraBudgetPenalty || 0);
    GameState.budget += totalBudgetImpact;
    if (GameState.budget < 0) GameState.budget = 0;

    // Apply score
    GameState.score += choice.score;

    // Apply reputation
    GameState.reputation += choice.reputationImpact;
    GameState.reputation = Math.max(0, Math.min(100, GameState.reputation));

    // Remove old effects
    if (choice.removeEffects && choice.removeEffects.length > 0) {
        GameState.statusEffects = GameState.statusEffects.filter(
            e => !choice.removeEffects.includes(e.id)
        );
    }

    // Add new effects
    if (choice.effects) {
        choice.effects.forEach(eff => {
            if (!GameState.statusEffects.some(e => e.id === eff.id)) {
                GameState.statusEffects.push(eff);
            }
        });
    }

    // Update UI
    updateHUD();
    renderStatusEffects();

    // Show consequence popup
    await showConsequencePopup(choice);
}

function updateHUD() {
    document.getElementById('hud-score').textContent = GameState.score;
    document.getElementById('hud-budget').textContent = formatCurrency(GameState.budget);
    updateReputationBar();

    // Animate score
    const scoreEl = document.getElementById('hud-score');
    scoreEl.style.transform = 'scale(1.4)';
    setTimeout(() => { scoreEl.style.transform = 'scale(1)'; scoreEl.style.transition = 'transform 0.3s'; }, 400);

    // Animate budget color
    const budgetEl = document.getElementById('hud-budget');
    if (GameState.budget < 100000) {
        budgetEl.style.color = 'var(--danger)';
    } else if (GameState.budget < 250000) {
        budgetEl.style.color = 'var(--warning)';
    } else {
        budgetEl.style.color = 'var(--success)';
    }
}

function updateReputationBar() {
    document.getElementById('reputation-fill').style.width = GameState.reputation + '%';
}

function renderStatusEffects() {
    const bar = document.getElementById('status-effects-bar');
    bar.innerHTML = GameState.statusEffects.map(e =>
        `<span class="status-pill ${e.type}">${e.label}</span>`
    ).join('');
}

function showConsequencePopup(choice) {
    return new Promise(resolve => {
        const popup = document.getElementById('consequence-popup');
        const icon = document.getElementById('consequence-icon');
        const text = document.getElementById('consequence-text');

        popup.className = 'consequence-popup';
        if (choice.quality === 'good') {
            popup.classList.add('good');
            icon.textContent = '✅';
        } else if (choice.quality === 'bad') {
            popup.classList.add('bad');
            icon.textContent = '❌';
        } else {
            popup.classList.add('neutral');
            icon.textContent = '⚠️';
        }

        text.innerHTML = `
            <div>${choice.consequence}</div>
            <div class="consequence-detail">${choice.consequenceDetail}</div>
        `;

        // Show backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'consequence-backdrop';
        backdrop.id = 'consequence-backdrop';
        document.body.appendChild(backdrop);

        popup.style.display = 'block';
        popup.style.animation = 'none';
        popup.offsetHeight; // trigger reflow
        popup.style.animation = '';

        setTimeout(() => {
            popup.style.display = 'none';
            const bd = document.getElementById('consequence-backdrop');
            if (bd) bd.remove();
            resolve();
        }, 2500);
    });
}

// ============ TIMER ============
function startTimer() {
    GameState.timeRemaining = CONFIG.TIMER_DURATION;
    const timerContainer = document.getElementById('timer-container');
    const timerFill = document.getElementById('timer-fill');
    const timerText = document.getElementById('timer-text');

    timerContainer.style.display = 'block';
    timerFill.style.width = '100%';
    timerText.textContent = GameState.timeRemaining + ' ثانية';
    timerText.classList.remove('urgent', 'reading');

    clearInterval(GameState.timerInterval);
    GameState.timerInterval = setInterval(() => {
        GameState.timeRemaining--;
        const percent = (GameState.timeRemaining / CONFIG.TIMER_DURATION) * 100;
        timerFill.style.width = percent + '%';
        timerText.textContent = GameState.timeRemaining + ' ثانية';

        if (GameState.timeRemaining <= 10) timerText.classList.add('urgent');

        if (GameState.timeRemaining <= 0) {
            clearInterval(GameState.timerInterval);
            if (GameState.isWaitingForInput && !GameState.isProcessing) {
                autoSelectTimeout();
            }
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(GameState.timerInterval);
    document.getElementById('timer-container').style.display = 'none';
}

function autoSelectTimeout() {
    // Timeout = worst choice is auto-selected
    const stageData = getStageData(GameState.currentStage);
    // Find the worst choice
    let worstIndex = 0;
    let worstScore = Infinity;
    stageData.choices.forEach((c, i) => {
        if (c.score < worstScore) { worstScore = c.score; worstIndex = i; }
    });

    addMessage('ai', '⏰ **انتهى الوقت!** لم تتخذ قراراً، وهذا في حد ذاته قرار سيئ!');
    if (typeof Avatar3D !== 'undefined') {
        Avatar3D.setSad();
    }
    selectChoice(worstIndex, stageData.choices);
}

// ============ MESSAGES ============
function addMessage(sender, text) {
    const container = document.getElementById('dialogue-messages');
    const div = document.createElement('div');
    div.className = `message message-${sender}`;
    const label = sender === 'ai' ? 'كريم 🧔' : GameState.playerName;
    div.innerHTML = `<div class="message-bubble"><span class="message-label">${label}</span><div class="message-text">${formatMessageText(text)}</div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('dialogue-messages');
    const div = document.createElement('div');
    div.className = 'message message-ai'; div.id = 'typing-indicator';
    div.innerHTML = `<div class="message-bubble"><span class="message-label">كريم 🧔</span><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function formatMessageText(text) {
    return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold-primary)">$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// ============ VOICE ENGINE ============
let currentAudioController = null;
let currentAudioResolve = null;
let lastSpokenText = '';

const SILENT_AUDIO = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function unlockAudio() {
    const audio = document.getElementById('tts-audio');
    if (audio) {
        audio.src = SILENT_AUDIO;
        audio.play().catch(() => {});
    }
}
document.addEventListener('click', () => unlockAudio(), { once: true });

function replayCurrentVoice() {
    if (lastSpokenText) {
        unlockAudio();
        playVoice(lastSpokenText);
    }
}

// Clean and extract a punchy spoken statement for fast TTS response
function prepareSpokenText(text) {
    let clean = (text || '')
        .replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[*#\-_>~`]/gu, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!clean) return '';

    // If short (commentary/feedback), return as is
    if (clean.length <= 180) return clean;

    // For long multi-paragraph scenarios, extract opening greeting & core dilemma
    const sentences = clean.split(/(?<=[.؟!؟\n])/).map(s => s.trim()).filter(Boolean);
    let chosen = '';
    for (const s of sentences) {
        if ((chosen + ' ' + s).length > 190 && chosen.length > 50) break;
        chosen = chosen ? (chosen + ' ' + s) : s;
    }
    return chosen || clean.substring(0, 180);
}

async function playVoice(text) {
    if (!GameState.voiceEnabled) return false;
    stopVoice();

    lastSpokenText = text;
    const spokenText = prepareSpokenText(text);
    if (!spokenText) return false;

    const speakingIndicator = document.getElementById('speaking-indicator');
    const badge = document.getElementById('voice-engine-badge');
    if (speakingIndicator) speakingIndicator.classList.add('active');

    if (badge) {
        badge.textContent = '🎙️ كريم';
        badge.style.display = 'inline-block';
    }

    // Call Fish Audio via local proxy (with s2.1-pro-free model header & caching)
    try {
        const controller = new AbortController();
        currentAudioController = controller;
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(CONFIG.FISH_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: spokenText,
                voice_id: CONFIG.FISH_VOICE_ID,
                api_key: CONFIG.FISH_API_KEY
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 500) {
                await playAudioBlob(blob);
                return true;
            }
        } else {
            const errText = await res.text().catch(() => '');
            console.warn('[Fish Audio] Error:', res.status, errText);
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.warn('[Fish Audio] Connection/generation error:', e.message);
        }
    }

    // Clean up if failed
    if (speakingIndicator) speakingIndicator.classList.remove('active');
    if (badge) badge.style.display = 'none';
    return false;
}

function playAudioBlob(blob) {
    return new Promise((resolve) => {
        const audio = document.getElementById('tts-audio');
        const speakingIndicator = document.getElementById('speaking-indicator');
        const badge = document.getElementById('voice-engine-badge');
        const url = URL.createObjectURL(blob);

        currentAudioResolve = resolve;
        audio.src = url;

        const cleanup = () => {
            if (speakingIndicator) speakingIndicator.classList.remove('active');
            if (badge) badge.style.display = 'none';
            if (typeof Avatar3D !== 'undefined') Avatar3D.setIdle();
            URL.revokeObjectURL(url);
            if (currentAudioResolve === resolve) {
                currentAudioResolve = null;
            }
            resolve(true);
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        if (typeof Avatar3D !== 'undefined') {
            Avatar3D.setTalking();
        }

        audio.play().catch(err => {
            console.warn('Audio playback error:', err);
            cleanup();
        });
    });
}

function playWebSpeech(spokenText) {
    return new Promise((resolve) => {
        const speakingIndicator = document.getElementById('speaking-indicator');
        const badge = document.getElementById('voice-engine-badge');

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        utterance.pitch = 0.95;

        // Find Arabic voice if installed on user OS/browser
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => v.lang && (v.lang.startsWith('ar') || v.lang.includes('SA') || v.lang.includes('EG')))
            || voices.find(v => (v.name && (v.name.includes('Arabic') || v.name.includes('Maged') || v.name.includes('Tarik') || v.name.includes('Naayf'))));
        if (arVoice) utterance.voice = arVoice;

        if (badge) {
            badge.textContent = '🎙️ كريم';
            badge.style.display = 'inline-block';
        }
        if (speakingIndicator) speakingIndicator.classList.add('active');

        let isDone = false;
        const cleanup = () => {
            if (isDone) return;
            isDone = true;
            if (speakingIndicator) speakingIndicator.classList.remove('active');
            if (badge) badge.style.display = 'none';
            if (typeof Avatar3D !== 'undefined') Avatar3D.setIdle();
            if (currentAudioResolve === resolve) currentAudioResolve = null;
            resolve(true);
        };

        currentAudioResolve = cleanup;
        utterance.onend = cleanup;
        utterance.onerror = (e) => {
            console.warn('[Web Speech] Error:', e);
            cleanup();
        };

        window.speechSynthesis.speak(utterance);
    });
}

function stopVoice() {
    // Abort any in-flight fetch
    if (currentAudioController) {
        currentAudioController.abort();
        currentAudioController = null;
    }
    // Stop any playing audio element
    const audio = document.getElementById('tts-audio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.onended = null;
        audio.onerror = null;
    }
    // Stop any Web Speech synthesis
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    if (currentAudioResolve) {
        const res = currentAudioResolve;
        currentAudioResolve = null;
        res(false);
    }
    // Clean up UI indicators & 3D avatar
    const speakingIndicator = document.getElementById('speaking-indicator');
    if (speakingIndicator) speakingIndicator.classList.remove('active');
    const badge = document.getElementById('voice-engine-badge');
    if (badge) badge.style.display = 'none';
    if (typeof Avatar3D !== 'undefined') Avatar3D.setIdle();
}


// ============ UTILITIES ============
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-SA').format(amount) + ' ر.س';
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function updateProgressBar(currentStage) {
    document.querySelectorAll('.progress-stage').forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i + 1 < currentStage) s.classList.add('completed');
        else if (i + 1 === currentStage) s.classList.add('active');
    });
}

// ============ END GAME ============
async function endGame() {
    GameState.gameEndTime = new Date();
    showLoading(true);

    const maxScore = CONFIG.TOTAL_STAGES * 15;
    const pct = Math.round((GameState.score / maxScore) * 100);

    let verdictResult, verdictClass, verdictIcon;
    if (pct >= 70 && GameState.reputation >= 50) {
        verdictResult = '🎉 مبروك! مشروعك أُطلق بنجاح!';
        verdictClass = 'success';
        verdictIcon = '🏆';
    } else if (pct >= 40) {
        verdictResult = '⚠️ مشروعك يحتاج تعديلات جوهرية';
        verdictClass = 'partial';
        verdictIcon = '⚠️';
    } else {
        verdictResult = '❌ للأسف المشروع فشل. حاول مرة ثانية!';
        verdictClass = 'failure';
        verdictIcon = '💔';
    }

    showLoading(false);
    showScreen('screen-verdict');

    if (typeof Avatar3D !== 'undefined') {
        if (verdictClass === 'success') {
            Avatar3D.setCheering();
        } else if (verdictClass === 'failure') {
            Avatar3D.setSad();
        } else {
            Avatar3D.setIdle();
        }
    }

    document.getElementById('verdict-icon').textContent = verdictIcon;
    document.getElementById('verdict-result').textContent = verdictResult;
    document.getElementById('verdict-result').className = `verdict-result ${verdictClass}`;

    const goodChoices = GameState.decisionLog.filter(d => d.quality === 'good').length;
    const badChoices = GameState.decisionLog.filter(d => d.quality === 'bad').length;

    document.getElementById('verdict-stats').innerHTML = `
        <div class="stat-card"><span class="stat-number">${GameState.score}</span><span class="stat-label">النقاط من ${maxScore}</span></div>
        <div class="stat-card"><span class="stat-number">${GameState.reputation}/100</span><span class="stat-label">السمعة النهائية</span></div>
        <div class="stat-card"><span class="stat-number">${formatCurrency(GameState.budget)}</span><span class="stat-label">الميزانية المتبقية</span></div>
    `;

    // Decision log
    let decisionsHTML = '';
    GameState.decisionLog.forEach(d => {
        const color = d.quality === 'good' ? 'var(--success)' : d.quality === 'bad' ? 'var(--danger)' : 'var(--warning)';
        const icon = d.quality === 'good' ? '✅' : d.quality === 'bad' ? '❌' : '⚠️';
        decisionsHTML += `<li>${icon} <strong style="color:${color}">${d.stageName}:</strong> ${d.choiceText}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">${d.consequence}</div></li>`;
    });

    document.getElementById('verdict-details').innerHTML = `
        <div class="verdict-section">
            <h3>📋 سجل القرارات (${goodChoices} صح / ${badChoices} خطأ)</h3>
            <ul>${decisionsHTML}</ul>
        </div>
    `;

    if (GameState.voiceEnabled) {
        const vt = pct >= 70
            ? `تهانينا يا ${GameState.playerName}! كانت قراراتك الاستراتيجية ممتازة ومشروعك جاهز للإطلاق الناجح.`
            : pct >= 40
            ? `يا ${GameState.playerName}، بعض قراراتك كانت موفقة وبعضها يحتاج إلى مراجعة جادة.`
            : `يا ${GameState.playerName}، للأسف لم تكن قراراتك في المستوى المطلوب. حاول مرة أخرى واستفد من الدروس.`;
        playVoice(vt);
    }
}

// ============ REPORT ============
async function generateReport() {
    showLoading(true);
    const maxScore = CONFIG.TOTAL_STAGES * 15;
    const pct = Math.round((GameState.score / maxScore) * 100);
    const totalTime = Math.round((GameState.gameEndTime - GameState.gameStartTime) / 1000);
    const mins = Math.floor(totalTime / 60), secs = totalTime % 60;

    const decisionsText = GameState.decisionLog.map(d =>
        `المرحلة ${d.stage} (${d.stageName}): اختار "${d.choiceText}" [${d.quality === 'good' ? 'صح' : d.quality === 'bad' ? 'خطأ' : 'متوسط'}] → ${d.consequence} | نقاط: ${d.score}/15 | تأثير الميزانية: ${d.budgetImpact} | تأثير السمعة: ${d.reputationImpact}`
    ).join('\n');

    const reportPrompt = `اكتب تقرير تفصيلي باللغة العربية الفصحى عن أداء اللاعب في محاكاة ريادة الأعمال.

اللاعب: ${GameState.playerName}
القطاع: ${GameState.sector}
النقاط: ${GameState.score}/${maxScore} (${pct}%)
السمعة النهائية: ${GameState.reputation}/100
الميزانية المتبقية: ${formatCurrency(GameState.budget)}
الوقت: ${mins} دقيقة و ${secs} ثانية
التأثيرات النشطة: ${GameState.statusEffects.map(e => e.label).join('، ')}

سجل القرارات:
${decisionsText}

اكتب التقرير بالأقسام:
1. ملخص تنفيذي
2. تحليل كل قرار وعواقبه
3. نقاط القوة
4. الأخطاء والدروس المستفادة
5. توصيات للمستقبل
6. تقييم عام`;

    try {
        const response = await fetch(CONFIG.GROQ_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}` },
            body: JSON.stringify({
                messages: [{ role: 'system', content: reportPrompt }, { role: 'user', content: 'اكتب التقرير' }],
                model: CONFIG.GROQ_MODEL, temperature: 0.5, max_tokens: 1500,
            })
        });
        const data = await response.json();
        const reportText = data.choices[0].message.content;
        showLoading(false);
        showScreen('screen-report');

        document.getElementById('report-content').innerHTML = `
            <div style="text-align:center; margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border-color);">
                <h3 style="color:var(--gold-primary); font-size:1.5rem;">تقرير أداء محاكاة ريادة الأعمال</h3>
                <p style="color:var(--text-muted);">${new Date().toLocaleDateString('ar-SA')}</p>
                <p style="color:var(--text-muted);">${GameState.playerName} | ${GameState.sector}</p>
                <p><span class="highlight">${GameState.score}/${maxScore} (${pct}%) | سمعة: ${GameState.reputation}/100</span></p>
            </div>
            ${formatMessageText(reportText)}
            <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--border-color);">
                <h3>📋 سجل القرارات التفصيلي</h3>
                ${GameState.decisionLog.map(d => `
                    <div style="background:var(--bg-input); padding:1rem; border-radius:8px; margin:0.8rem 0; border-right:3px solid ${d.quality === 'good' ? 'var(--success)' : d.quality === 'bad' ? 'var(--danger)' : 'var(--warning)'};">
                        <strong style="color:var(--gold-primary);">${d.stageName}</strong>
                        <span style="float:left; color:${d.quality === 'good' ? 'var(--success)' : d.quality === 'bad' ? 'var(--danger)' : 'var(--warning)'};">${d.score}/15</span>
                        <p style="margin-top:0.5rem; font-size:0.85rem;">${d.choiceText}</p>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.3rem;">${d.consequence}</p>
                    </div>
                `).join('')}
            </div>`;
    } catch (e) {
        showLoading(false);
        showScreen('screen-report');
        document.getElementById('report-content').innerHTML = '<p>تعذر إنشاء التقرير. يرجى المحاولة مرة أخرى.</p>';
    }
}

function downloadReport() {
    const content = document.getElementById('report-content').innerText;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_${GameState.playerName}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============ RESTART ============
function restartGame() {
    GameState.playerName = '';
    GameState.sector = '';
    GameState.attitude = 3;
    GameState.businessModel = null;
    GameState.businessModelText = '';
    GameState.currentStage = 0;
    GameState.score = 0;
    GameState.budget = CONFIG.INITIAL_BUDGET;
    GameState.reputation = CONFIG.INITIAL_REPUTATION;
    GameState.conversationHistory = [];
    GameState.stageResults = [];
    GameState.statusEffects = [];
    GameState.decisionLog = [];
    GameState.isWaitingForInput = false;
    GameState.isProcessing = false;

    document.getElementById('player-name').value = '';
    document.getElementById('attitude-slider').value = 3;
    document.getElementById('attitude-value').textContent = 'متوسط';
    document.querySelectorAll('.sector-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('upload-area').classList.remove('has-file');
    document.getElementById('upload-status').textContent = '';
    document.getElementById('dialogue-messages').innerHTML = '';
    document.getElementById('file-input').value = '';
    document.getElementById('status-effects-bar').innerHTML = '';

    stopTimer(); stopVoice();
    if (typeof Avatar3D !== 'undefined') Avatar3D.setIdle();
    showScreen('screen-splash');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    if (typeof Avatar3D !== 'undefined') {
        Avatar3D.init('avatar-3d-container');
    }
});
