(function () {
    'use strict';

    if (window.__jellyfinAdvancedBooksLocalizationLoaded) return;
    window.__jellyfinAdvancedBooksLocalizationLoaded = true;

    const dictionaries = {
        en: {},
        ja: {
            'Advanced Reader': '高度なリーダー',
            'Open Advanced Reader': '高度なリーダーを開く',
            'Close reader': 'リーダーを閉じる',
            'Close (Esc)': '閉じる (Esc)',
            'Reader settings': 'リーダー設定',
            'Close reader settings': 'リーダー設定を閉じる',
            'Close settings': '設定を閉じる',
            'Enter fullscreen': '全画面表示にする',
            'Exit fullscreen': '全画面表示を終了',
            'Fullscreen (F)': '全画面表示 (F)',
            'Exit fullscreen (F)': '全画面表示を終了 (F)',
            'Pages': 'ページ',
            'Open page navigator': 'ページ一覧を開く',
            'Page navigator': 'ページ一覧',
            'Close page navigator': 'ページ一覧を閉じる',
            'Layout': 'レイアウト',
            'Reader layout': 'リーダーレイアウト',
            'Single page': '単一ページ',
            'Double page': '見開き',
            'Vertical continuous': '縦スクロール',
            'Webtoon': 'ウェブトゥーン',
            'Reading direction': '読む方向',
            'Paged reading direction': 'ページ送り方向',
            'Right to left': '右から左',
            'Left to right': '左から右',
            'Fit': '表示サイズ',
            'Image fit': '画像の合わせ方',
            'Fit screen': '画面に合わせる',
            'Fit width': '幅に合わせる',
            'Fit height': '高さに合わせる',
            'Original size': '元のサイズ',
            'Zoom': 'ズーム',
            'Zoom in': '拡大',
            'Zoom out': '縮小',
            'Reset zoom': 'ズームをリセット',
            'Zoom in / out / reset': '拡大 / 縮小 / リセット',
            'Background': '背景',
            'Reader background': 'リーダー背景',
            'Black': '黒',
            'Gray': 'グレー',
            'White': '白',
            'Page transitions': 'ページ切替アニメーション',
            'Page transition animation': 'ページ切替アニメーション',
            'Touch gestures': 'タッチジェスチャー',
            'Side padding': '左右余白',
            'Continuous side padding': '連続表示の左右余白',
            'Page gap': 'ページ間隔',
            'Continuous page gap': '連続表示のページ間隔',
            'Previous page': '前のページ',
            'Next page': '次のページ',
            'Jump to page': 'ページへ移動',
            'Preview unavailable': 'プレビューを表示できません',
            'Failed to load': '読み込みに失敗しました',
            'Loading page…': 'ページを読み込み中…',
            'Loading preview…': 'プレビューを読み込み中…',
            'Advanced Books Reader': 'Advanced Books リーダー',
            'Unknown error': '不明なエラー',
            'Unable to load page': 'ページを読み込めません',
            'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.': '縦スクロールとウェブトゥーンでは1本指の標準スクロールを維持します。左右余白とページ間隔で連続表示を調整でき、ズームはすべてのモードで利用できます。',
            'Reader closed': 'リーダーは閉じられました',
            'Comic page viewport': 'コミックページ表示領域',
            'Reader help': 'リーダーヘルプ',
            'Close reader help': 'リーダーヘルプを閉じる',
            'Close help': 'ヘルプを閉じる',
            'Reader controls': 'リーダー操作',
            'Metadata': 'メタデータ',
            'Metadata header': 'メタデータ表示',
            'Title': 'タイトル',
            'Authors': '著者',
            'Series': 'シリーズ',
            'Issue / number': '号 / 巻番号',
            'Year': '年',
            'Auto-scroll': '自動スクロール',
            'Show': '表示',
            'Hide': '非表示',
            'On': 'オン',
            'Off': 'オフ',
            'Previous / next page in paged modes': 'ページ表示で前 / 次のページ',
            'Previous / next page or group': '前 / 次のページまたは見開き',
            'Next page or group': '次のページまたは見開き',
            'First / last page': '最初 / 最後のページ',
            'Pan while zoomed': '拡大中にドラッグ移動',
            'Zoom when touch gestures are enabled': 'タッチジェスチャー有効時にズーム',
            'Close panel, then reader': 'パネルを閉じ、次にリーダーを閉じる',
            'Two-finger pinch': '2本指ピンチ',
            'Drag': 'ドラッグ',
            'Book': '本'
        },
        de: {
            'Advanced Reader': 'Erweiterter Reader',
            'Open Advanced Reader': 'Erweiterten Reader öffnen',
            'Close reader': 'Reader schließen',
            'Close (Esc)': 'Schließen (Esc)',
            'Reader settings': 'Reader-Einstellungen',
            'Close reader settings': 'Reader-Einstellungen schließen',
            'Close settings': 'Einstellungen schließen',
            'Enter fullscreen': 'Vollbild öffnen',
            'Exit fullscreen': 'Vollbild verlassen',
            'Fullscreen (F)': 'Vollbild (F)',
            'Exit fullscreen (F)': 'Vollbild verlassen (F)',
            'Pages': 'Seiten',
            'Open page navigator': 'Seitennavigation öffnen',
            'Page navigator': 'Seitennavigation',
            'Close page navigator': 'Seitennavigation schließen',
            'Layout': 'Layout',
            'Reader layout': 'Reader-Layout',
            'Single page': 'Einzelseite',
            'Double page': 'Doppelseite',
            'Vertical continuous': 'Vertikal fortlaufend',
            'Webtoon': 'Webtoon',
            'Reading direction': 'Leserichtung',
            'Paged reading direction': 'Seiten-Leserichtung',
            'Right to left': 'Rechts nach links',
            'Left to right': 'Links nach rechts',
            'Fit': 'Anpassen',
            'Image fit': 'Bildanpassung',
            'Fit screen': 'An Bildschirm anpassen',
            'Fit width': 'An Breite anpassen',
            'Fit height': 'An Höhe anpassen',
            'Original size': 'Originalgröße',
            'Zoom': 'Zoom',
            'Zoom in': 'Vergrößern',
            'Zoom out': 'Verkleinern',
            'Reset zoom': 'Zoom zurücksetzen',
            'Zoom in / out / reset': 'Vergrößern / verkleinern / zurücksetzen',
            'Background': 'Hintergrund',
            'Reader background': 'Reader-Hintergrund',
            'Black': 'Schwarz',
            'Gray': 'Grau',
            'White': 'Weiß',
            'Page transitions': 'Seitenübergänge',
            'Page transition animation': 'Seitenübergangsanimation',
            'Touch gestures': 'Touch-Gesten',
            'Side padding': 'Seitenrand',
            'Continuous side padding': 'Seitenrand im Endlosmodus',
            'Page gap': 'Seitenabstand',
            'Continuous page gap': 'Seitenabstand im Endlosmodus',
            'Previous page': 'Vorherige Seite',
            'Next page': 'Nächste Seite',
            'Jump to page': 'Zu Seite springen',
            'Preview unavailable': 'Vorschau nicht verfügbar',
            'Failed to load': 'Laden fehlgeschlagen',
            'Loading page…': 'Seite wird geladen…',
            'Loading preview…': 'Vorschau wird geladen…',
            'Advanced Books Reader': 'Advanced Books Reader',
            'Unknown error': 'Unbekannter Fehler',
            'Unable to load page': 'Seite konnte nicht geladen werden',
            'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.': 'Vertikal und Webtoon behalten das native Scrollen mit einem Finger bei. Seitenrand und Seitenabstand passen fortlaufende Layouts an; Zoom ist in jedem Modus verfügbar.',
            'Reader closed': 'Reader geschlossen',
            'Comic page viewport': 'Comic-Seitenansicht',
            'Reader help': 'Reader-Hilfe',
            'Close reader help': 'Reader-Hilfe schließen',
            'Close help': 'Hilfe schließen',
            'Reader controls': 'Reader-Steuerung',
            'Metadata': 'Metadaten',
            'Metadata header': 'Metadatenkopf',
            'Title': 'Titel',
            'Authors': 'Autoren',
            'Series': 'Serie',
            'Issue / number': 'Ausgabe / Nummer',
            'Year': 'Jahr',
            'Auto-scroll': 'Automatisch scrollen',
            'Show': 'Anzeigen',
            'Hide': 'Ausblenden',
            'On': 'Ein',
            'Off': 'Aus',
            'Previous / next page in paged modes': 'Vorherige / nächste Seite im Seitenmodus',
            'Previous / next page or group': 'Vorherige / nächste Seite oder Gruppe',
            'Next page or group': 'Nächste Seite oder Gruppe',
            'First / last page': 'Erste / letzte Seite',
            'Pan while zoomed': 'Bei Zoom verschieben',
            'Zoom when touch gestures are enabled': 'Zoomen bei aktivierten Touch-Gesten',
            'Close panel, then reader': 'Zuerst Panel, dann Reader schließen',
            'Two-finger pinch': 'Zwei-Finger-Zoom',
            'Drag': 'Ziehen',
            'Book': 'Buch'
        },
        fr: {
            'Advanced Reader': 'Lecteur avancé',
            'Open Advanced Reader': 'Ouvrir le lecteur avancé',
            'Close reader': 'Fermer le lecteur',
            'Close (Esc)': 'Fermer (Échap)',
            'Reader settings': 'Paramètres du lecteur',
            'Close reader settings': 'Fermer les paramètres du lecteur',
            'Close settings': 'Fermer les paramètres',
            'Enter fullscreen': 'Passer en plein écran',
            'Exit fullscreen': 'Quitter le plein écran',
            'Fullscreen (F)': 'Plein écran (F)',
            'Exit fullscreen (F)': 'Quitter le plein écran (F)',
            'Pages': 'Pages',
            'Open page navigator': 'Ouvrir le navigateur de pages',
            'Page navigator': 'Navigateur de pages',
            'Close page navigator': 'Fermer le navigateur de pages',
            'Layout': 'Disposition',
            'Reader layout': 'Disposition du lecteur',
            'Single page': 'Page unique',
            'Double page': 'Double page',
            'Vertical continuous': 'Défilement vertical',
            'Webtoon': 'Webtoon',
            'Reading direction': 'Sens de lecture',
            'Paged reading direction': 'Sens de lecture paginé',
            'Right to left': 'De droite à gauche',
            'Left to right': 'De gauche à droite',
            'Fit': 'Ajustement',
            'Image fit': 'Ajustement de l’image',
            'Fit screen': 'Adapter à l’écran',
            'Fit width': 'Adapter à la largeur',
            'Fit height': 'Adapter à la hauteur',
            'Original size': 'Taille d’origine',
            'Zoom': 'Zoom',
            'Zoom in': 'Agrandir',
            'Zoom out': 'Réduire',
            'Reset zoom': 'Réinitialiser le zoom',
            'Zoom in / out / reset': 'Agrandir / réduire / réinitialiser',
            'Background': 'Arrière-plan',
            'Reader background': 'Arrière-plan du lecteur',
            'Black': 'Noir',
            'Gray': 'Gris',
            'White': 'Blanc',
            'Page transitions': 'Transitions de page',
            'Page transition animation': 'Animation de transition',
            'Touch gestures': 'Gestes tactiles',
            'Side padding': 'Marge latérale',
            'Continuous side padding': 'Marge latérale continue',
            'Page gap': 'Espacement des pages',
            'Continuous page gap': 'Espacement en mode continu',
            'Previous page': 'Page précédente',
            'Next page': 'Page suivante',
            'Jump to page': 'Aller à la page',
            'Preview unavailable': 'Aperçu indisponible',
            'Failed to load': 'Échec du chargement',
            'Loading page…': 'Chargement de la page…',
            'Loading preview…': 'Chargement de l’aperçu…',
            'Advanced Books Reader': 'Lecteur Advanced Books',
            'Unknown error': 'Erreur inconnue',
            'Unable to load page': 'Impossible de charger la page',
            'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.': 'Les modes vertical et Webtoon conservent le défilement natif à un doigt. Utilisez la marge latérale et l’espacement des pages pour régler les modes continus ; le zoom reste disponible partout.',
            'Reader closed': 'Lecteur fermé',
            'Comic page viewport': 'Zone d’affichage de la page',
            'Reader help': 'Aide du lecteur',
            'Close reader help': 'Fermer l’aide du lecteur',
            'Close help': 'Fermer l’aide',
            'Reader controls': 'Commandes du lecteur',
            'Metadata': 'Métadonnées',
            'Metadata header': 'En-tête des métadonnées',
            'Title': 'Titre',
            'Authors': 'Auteurs',
            'Series': 'Série',
            'Issue / number': 'Numéro / tome',
            'Year': 'Année',
            'Auto-scroll': 'Défilement automatique',
            'Show': 'Afficher',
            'Hide': 'Masquer',
            'On': 'Activé',
            'Off': 'Désactivé',
            'Previous / next page in paged modes': 'Page précédente / suivante en mode paginé',
            'Previous / next page or group': 'Page ou groupe précédent / suivant',
            'Next page or group': 'Page ou groupe suivant',
            'First / last page': 'Première / dernière page',
            'Pan while zoomed': 'Déplacer pendant le zoom',
            'Zoom when touch gestures are enabled': 'Zoomer lorsque les gestes tactiles sont activés',
            'Close panel, then reader': 'Fermer le panneau puis le lecteur',
            'Two-finger pinch': 'Pincement à deux doigts',
            'Drag': 'Glisser',
            'Book': 'Livre'
        },
        es: {
            'Advanced Reader': 'Lector avanzado',
            'Open Advanced Reader': 'Abrir lector avanzado',
            'Close reader': 'Cerrar lector',
            'Close (Esc)': 'Cerrar (Esc)',
            'Reader settings': 'Ajustes del lector',
            'Close reader settings': 'Cerrar ajustes del lector',
            'Close settings': 'Cerrar ajustes',
            'Enter fullscreen': 'Entrar en pantalla completa',
            'Exit fullscreen': 'Salir de pantalla completa',
            'Fullscreen (F)': 'Pantalla completa (F)',
            'Exit fullscreen (F)': 'Salir de pantalla completa (F)',
            'Pages': 'Páginas',
            'Open page navigator': 'Abrir navegador de páginas',
            'Page navigator': 'Navegador de páginas',
            'Close page navigator': 'Cerrar navegador de páginas',
            'Layout': 'Diseño',
            'Reader layout': 'Diseño del lector',
            'Single page': 'Página única',
            'Double page': 'Página doble',
            'Vertical continuous': 'Vertical continuo',
            'Webtoon': 'Webtoon',
            'Reading direction': 'Dirección de lectura',
            'Paged reading direction': 'Dirección de lectura paginada',
            'Right to left': 'De derecha a izquierda',
            'Left to right': 'De izquierda a derecha',
            'Fit': 'Ajuste',
            'Image fit': 'Ajuste de imagen',
            'Fit screen': 'Ajustar a pantalla',
            'Fit width': 'Ajustar al ancho',
            'Fit height': 'Ajustar a la altura',
            'Original size': 'Tamaño original',
            'Zoom': 'Zoom',
            'Zoom in': 'Acercar',
            'Zoom out': 'Alejar',
            'Reset zoom': 'Restablecer zoom',
            'Zoom in / out / reset': 'Acercar / alejar / restablecer',
            'Background': 'Fondo',
            'Reader background': 'Fondo del lector',
            'Black': 'Negro',
            'Gray': 'Gris',
            'White': 'Blanco',
            'Page transitions': 'Transiciones de página',
            'Page transition animation': 'Animación de transición',
            'Touch gestures': 'Gestos táctiles',
            'Side padding': 'Margen lateral',
            'Continuous side padding': 'Margen lateral continuo',
            'Page gap': 'Espacio entre páginas',
            'Continuous page gap': 'Espacio continuo entre páginas',
            'Previous page': 'Página anterior',
            'Next page': 'Página siguiente',
            'Jump to page': 'Ir a la página',
            'Preview unavailable': 'Vista previa no disponible',
            'Failed to load': 'Error al cargar',
            'Loading page…': 'Cargando página…',
            'Loading preview…': 'Cargando vista previa…',
            'Advanced Books Reader': 'Lector Advanced Books',
            'Unknown error': 'Error desconocido',
            'Unable to load page': 'No se pudo cargar la página',
            'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.': 'Vertical y Webtoon mantienen el desplazamiento nativo con un dedo. Use el margen lateral y el espacio entre páginas para ajustar los modos continuos; el zoom sigue disponible en todos los modos.',
            'Reader closed': 'Lector cerrado',
            'Comic page viewport': 'Área de página del cómic',
            'Reader help': 'Ayuda del lector',
            'Close reader help': 'Cerrar ayuda del lector',
            'Close help': 'Cerrar ayuda',
            'Reader controls': 'Controles del lector',
            'Metadata': 'Metadatos',
            'Metadata header': 'Encabezado de metadatos',
            'Title': 'Título',
            'Authors': 'Autores',
            'Series': 'Serie',
            'Issue / number': 'Número / tomo',
            'Year': 'Año',
            'Auto-scroll': 'Desplazamiento automático',
            'Show': 'Mostrar',
            'Hide': 'Ocultar',
            'On': 'Activado',
            'Off': 'Desactivado',
            'Previous / next page in paged modes': 'Página anterior / siguiente en modo paginado',
            'Previous / next page or group': 'Página o grupo anterior / siguiente',
            'Next page or group': 'Página o grupo siguiente',
            'First / last page': 'Primera / última página',
            'Pan while zoomed': 'Desplazar mientras está ampliado',
            'Zoom when touch gestures are enabled': 'Zoom con gestos táctiles activados',
            'Close panel, then reader': 'Cerrar panel y después lector',
            'Two-finger pinch': 'Pellizco con dos dedos',
            'Drag': 'Arrastrar',
            'Book': 'Libro'
        },
        'zh-CN': {
            'Advanced Reader': '高级阅读器',
            'Open Advanced Reader': '打开高级阅读器',
            'Close reader': '关闭阅读器',
            'Close (Esc)': '关闭 (Esc)',
            'Reader settings': '阅读器设置',
            'Close reader settings': '关闭阅读器设置',
            'Close settings': '关闭设置',
            'Enter fullscreen': '进入全屏',
            'Exit fullscreen': '退出全屏',
            'Fullscreen (F)': '全屏 (F)',
            'Exit fullscreen (F)': '退出全屏 (F)',
            'Pages': '页面',
            'Open page navigator': '打开页面导航',
            'Page navigator': '页面导航',
            'Close page navigator': '关闭页面导航',
            'Layout': '布局',
            'Reader layout': '阅读器布局',
            'Single page': '单页',
            'Double page': '双页',
            'Vertical continuous': '纵向连续',
            'Webtoon': '条漫',
            'Reading direction': '阅读方向',
            'Paged reading direction': '翻页方向',
            'Right to left': '从右到左',
            'Left to right': '从左到右',
            'Fit': '适应方式',
            'Image fit': '图像适应',
            'Fit screen': '适应屏幕',
            'Fit width': '适应宽度',
            'Fit height': '适应高度',
            'Original size': '原始大小',
            'Zoom': '缩放',
            'Zoom in': '放大',
            'Zoom out': '缩小',
            'Reset zoom': '重置缩放',
            'Zoom in / out / reset': '放大 / 缩小 / 重置',
            'Background': '背景',
            'Reader background': '阅读器背景',
            'Black': '黑色',
            'Gray': '灰色',
            'White': '白色',
            'Page transitions': '页面切换',
            'Page transition animation': '页面切换动画',
            'Touch gestures': '触摸手势',
            'Side padding': '两侧留白',
            'Continuous side padding': '连续模式两侧留白',
            'Page gap': '页面间距',
            'Continuous page gap': '连续模式页面间距',
            'Previous page': '上一页',
            'Next page': '下一页',
            'Jump to page': '跳转到页面',
            'Preview unavailable': '无法预览',
            'Failed to load': '加载失败',
            'Loading page…': '正在加载页面…',
            'Loading preview…': '正在加载预览…',
            'Advanced Books Reader': 'Advanced Books 阅读器',
            'Unknown error': '未知错误',
            'Unable to load page': '无法加载页面',
            'Vertical and Webtoon keep native one-finger scrolling. Use Side padding and Page gap to tune continuous layouts; reader zoom remains available in every mode.': '纵向连续和条漫模式保留原生单指滚动。可使用两侧留白和页面间距调整连续布局；所有模式均可使用缩放。',
            'Reader closed': '阅读器已关闭',
            'Comic page viewport': '漫画页面显示区域',
            'Reader help': '阅读器帮助',
            'Close reader help': '关闭阅读器帮助',
            'Close help': '关闭帮助',
            'Reader controls': '阅读器操作',
            'Metadata': '元数据',
            'Metadata header': '元数据显示',
            'Title': '标题',
            'Authors': '作者',
            'Series': '系列',
            'Issue / number': '卷 / 期号',
            'Year': '年份',
            'Auto-scroll': '自动滚动',
            'Show': '显示',
            'Hide': '隐藏',
            'On': '开启',
            'Off': '关闭',
            'Previous / next page in paged modes': '分页模式中的上一页 / 下一页',
            'Previous / next page or group': '上一页 / 下一页或跨页',
            'Next page or group': '下一页或跨页',
            'First / last page': '第一页 / 最后一页',
            'Pan while zoomed': '缩放时拖动',
            'Zoom when touch gestures are enabled': '启用触摸手势时缩放',
            'Close panel, then reader': '先关闭面板，再关闭阅读器',
            'Two-finger pinch': '双指缩放',
            'Drag': '拖动',
            'Book': '书籍'
        }
    };

    const actionTitles = {
        'Reader settings': 'settings',
        'Reset zoom': 'zoom-reset',
        'Zoom in': 'zoom-in',
        'Zoom out': 'zoom-out',
        'Previous page': 'previous',
        'Next page': 'next',
        'Close reader': 'close',
        'Open page navigator': 'navigator',
        'Fullscreen (F)': 'fullscreen',
        'Exit fullscreen (F)': 'fullscreen'
    };

    function normalizeLocale(value) {
        const locale = String(value || '').replace('_', '-').toLowerCase();
        if (locale.startsWith('ja')) return 'ja';
        if (locale.startsWith('de')) return 'de';
        if (locale.startsWith('fr')) return 'fr';
        if (locale.startsWith('es')) return 'es';
        if (locale.startsWith('zh')) return 'zh-CN';
        return 'en';
    }

    const locale = normalizeLocale(
        document.documentElement.lang
        || navigator.languages?.[0]
        || navigator.language
        || 'en'
    );
    const dictionary = dictionaries[locale] || dictionaries.en;

    function t(value) {
        return dictionary[value] || value;
    }

    function translateMetadataValue(value) {
        const prefixes = {
            'Authors: ': { ja: '著者: ', de: 'Autoren: ', fr: 'Auteurs : ', es: 'Autores: ', 'zh-CN': '作者: ' },
            'Series: ': { ja: 'シリーズ: ', de: 'Serie: ', fr: 'Série : ', es: 'Serie: ', 'zh-CN': '系列: ' },
            'Issue: ': { ja: '号: ', de: 'Ausgabe: ', fr: 'Numéro : ', es: 'Número: ', 'zh-CN': '卷/期: ' },
            'Year: ': { ja: '年: ', de: 'Jahr: ', fr: 'Année : ', es: 'Año: ', 'zh-CN': '年份: ' }
        };
        let result = value;
        for (const [prefix, translations] of Object.entries(prefixes)) {
            const translated = translations[locale];
            if (translated) result = result.split(prefix).join(translated);
        }
        return result;
    }

    function translateDynamic(value) {
        let match = /^Page (\d+)$/.exec(value);
        if (match) {
            const label = {
                ja: 'ページ', de: 'Seite', fr: 'Page', es: 'Página', 'zh-CN': '第'
            }[locale];
            if (locale === 'zh-CN') return `第 ${match[1]} 页`;
            return label ? `${label} ${match[1]}` : value;
        }

        match = /^Preview of page (\d+)$/.exec(value);
        if (match) {
            const templates = {
                ja: `ページ ${match[1]} のプレビュー`,
                de: `Vorschau von Seite ${match[1]}`,
                fr: `Aperçu de la page ${match[1]}`,
                es: `Vista previa de la página ${match[1]}`,
                'zh-CN': `第 ${match[1]} 页预览`
            };
            return templates[locale] || value;
        }

        match = /^(\d+) pages$/.exec(value);
        if (match) {
            const templates = {
                ja: `${match[1]} ページ`,
                de: `${match[1]} Seiten`,
                fr: `${match[1]} pages`,
                es: `${match[1]} páginas`,
                'zh-CN': `${match[1]} 页`
            };
            return templates[locale] || value;
        }

        match = /^Unable to load page: (.*)$/.exec(value);
        if (match) return `${t('Unable to load page')}: ${t(match[1])}`;

        const pageSuffix = /^(.*) — page (\d+)$/.exec(value);
        if (pageSuffix) {
            const translatedPrefix = t(pageSuffix[1]);
            const pageWord = { ja: 'ページ', de: 'Seite', fr: 'page', es: 'página', 'zh-CN': '页' }[locale] || 'page';
            return locale === 'zh-CN'
                ? `${translatedPrefix} — 第 ${pageSuffix[2]} ${pageWord}`
                : `${translatedPrefix} — ${pageWord} ${pageSuffix[2]}`;
        }

        return t(value);
    }

    function annotateAction(element) {
        const title = element.getAttribute?.('title');
        const action = actionTitles[title];
        if (action && !element.dataset.abAction) element.dataset.abAction = action;
    }

    function translateAttribute(element, name) {
        const current = element.getAttribute?.(name);
        if (!current) return;
        const translated = translateDynamic(current);
        if (translated !== current) element.setAttribute(name, translated);
    }

    function translateLeaf(element) {
        if (!(element instanceof HTMLElement) || element.childElementCount !== 0) return;
        if (element.classList.contains('advancedBooksReaderMetadataText')) {
            const value = element.textContent?.trim();
            if (!value) return;
            const translated = translateMetadataValue(value);
            if (translated !== value) element.textContent = translated;
            return;
        }

        const value = element.textContent?.trim();
        if (!value) return;
        const translated = translateDynamic(value);
        if (translated !== value) element.textContent = translated;
    }

    function translateRoot(root) {
        const elements = [];
        if (root instanceof HTMLElement) elements.push(root);
        if (root.querySelectorAll) {
            elements.push(...root.querySelectorAll(
                '.advancedBooksReaderButton,.advancedBooksReaderOverlay,.advancedBooksReaderOverlay *'
            ));
        }
        for (const element of elements) {
            annotateAction(element);
            const userValue = element.closest?.('.advancedBooksReaderMetadata')
                || element.classList.contains('advancedBooksNavigatorCard');
            if (!userValue) {
                translateAttribute(element, 'title');
                translateAttribute(element, 'aria-label');
            }
            translateLeaf(element);
        }
    }

    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') {
                translateRoot(record.target);
                continue;
            }
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) translateRoot(node);
                else if (node.parentElement) translateRoot(node.parentElement);
            }
            if (record.type === 'characterData' && record.target.parentElement) {
                translateRoot(record.target.parentElement);
            }
        }
    });

    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['title', 'aria-label']
    });

    window.AdvancedBooksI18n = Object.freeze({
        locale,
        supportedLocales: Object.freeze(['en', 'ja', 'de', 'fr', 'es', 'zh-CN']),
        t: translateDynamic,
        translateRoot
    });

    translateRoot(document);
}());
