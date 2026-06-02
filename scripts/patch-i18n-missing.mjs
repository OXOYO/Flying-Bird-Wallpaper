/**
 * 补全 AI 相关 20 个缺失键；修正 zh-TW 若干条目。
 * 运行: node scripts/patch-i18n-missing.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const langDir = path.join(process.cwd(), 'src/i18n/locale/lang')

const aiKeys = {
  pumpBlockReason_scheduler_stopped: null,
  pumpBlockReason_power_save_battery: null,
  pumpBlockReason_maintenance: null,
  pumpBlockReason_lock: null,
  pumpBlockReason_main_ui_not_ready: null,
  pumpBlockReason_mode: null,
  pumpBlockReason_disabled: null,
  runStatusDisabled: null,
  runStatusDisabledHint: null,
  requeueFailedConfirm: null,
  requeueFailedSuccess: null,
  requeueFailedSuccessNoAi: null,
  requeueFailedSuccessNoPump: null,
  requeueFailedEmpty: null
}

const utilsKeys = {
  clearAiAnalysisData: null,
  clearAiAnalysisDataConfirm: null,
  resetAiAnalysisSuccess: null,
  resetAiAnalysisSuccessNoAi: null,
  resetAiAnalysisSuccessNoPump: null,
  resetAiAnalysisEmpty: null
}

const translations = {
  'zh-TW.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        '背景分析定時器已停止（常見於省電清任務後未恢復）；請儲存一次 AI 設定或接上交流電後重試',
      pumpBlockReason_power_save_battery: '省電模式且目前使用電池，已暫停背景分析',
      pumpBlockReason_maintenance: '資源維護中，分析已暫停',
      pumpBlockReason_lock: '分析佇列正被其它操作佔用，請稍後',
      pumpBlockReason_main_ui_not_ready: '主視窗尚未就緒，稍後將自動開始',
      pumpBlockReason_mode: '目前分析模式不會自動背景處理',
      pumpBlockReason_disabled: '已關閉「啟用 AI」',
      runStatusDisabled: 'AI 已關閉',
      runStatusDisabledHint:
        '已關閉「啟用 AI」，不會自動分析；可在此查看進度，開啟後將繼續處理待分析佇列',
      requeueFailedConfirm:
        '將 <strong>{count}</strong> 張分析失敗的圖片重新加入待分析佇列並重置失敗次數？<br/><br/>自動開始分析須已開啟「啟用 AI」，且分析模式為「背景連續」或「僅新圖」。',
      requeueFailedSuccess: '已將 {count} 張失敗圖片加入待分析佇列，背景將自動處理',
      requeueFailedSuccessNoAi: '已將 {count} 張加入待分析佇列；未開啟「啟用 AI」，不會自動分析',
      requeueFailedSuccessNoPump: '已將 {count} 張加入待分析佇列；目前分析模式不會自動背景處理',
      requeueFailedEmpty: '目前沒有分析失敗的圖片'
    },
    utils: {
      clearAiAnalysisData: '清空 AI 分析資料',
      clearAiAnalysisDataConfirm:
        '將<strong>庫內全部圖片</strong>的 AI 分析附表資料清空（AI 標題/描述/摘要/評分/敏感等級、標籤、向量等），並<strong>刪除全部 AI 推薦（系統）合集</strong>；外掛入庫的標題與描述保留在主表；使用者自建合集保留。<br/><br/>自動開始分析須已開啟<strong>「啟用 AI」</strong>，且分析模式為「背景連續」或「僅新圖」；否則請手動點「AI 分析」或調整設定。',
      resetAiAnalysisSuccess:
        '已清空庫內 {count} 條圖片的 AI 分析資料，已刪除 {autoCollections} 個 AI 推薦合集，背景將自動處理',
      resetAiAnalysisSuccessNoAi:
        '已清空庫內 {count} 條並標為待分析，已刪除 {autoCollections} 個 AI 推薦合集；未開啟「啟用 AI」，不會自動分析',
      resetAiAnalysisSuccessNoPump:
        '已清空庫內 {count} 條並標為待分析，已刪除 {autoCollections} 個 AI 推薦合集；目前分析模式不會自動背景處理，請手動分析或改為「背景連續」/「僅新圖」',
      resetAiAnalysisEmpty: '庫中沒有可清空的圖片'
    },
    twFix: {
      statFailedHint: '點擊可將失敗項重新加入待分析佇列',
      statEmbeddingLabel: '文字向量',
      analysisConcurrency: '背景分析並發',
      analysisConcurrencyHint:
        '背景連續/僅新圖模式下，同時呼叫視覺模型的張數（1～10）。儲存後立即生效；顯存不足時請降低並發。文字向量在每張分析成功後非同步寫入，不佔用此並發',
      textEmbedModelHint:
        '僅文字 embedding，用於語意搜尋（如 nomic-embed-text）；與畫面向量、視覺分析無關',
      'errors.modelNameMissing': '請先選擇或輸入模型名稱'
    }
  },
  'ja-JP.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'バックグラウンド分析タイマーが停止しています（省電でタスク削除後など）。AI設定を保存するか、AC電源に接続してください。',
      pumpBlockReason_power_save_battery: '省電モードかつバッテリー駆動のため、バックグラウンド分析を一時停止しています',
      pumpBlockReason_maintenance: 'リソースメンテナンス中のため、分析を一時停止しています',
      pumpBlockReason_lock: '分析キューが他の処理で使用中です。しばらくお待ちください',
      pumpBlockReason_main_ui_not_ready: 'メインウィンドウの準備中です。まもなく自動的に開始します',
      pumpBlockReason_mode: '現在の分析モードではバックグラウンドで自動実行されません',
      pumpBlockReason_disabled: '「AIを有効化」がオフです',
      runStatusDisabled: 'AIオフ',
      runStatusDisabledHint:
        '「AIを有効化」がオフのため自動分析は行われません。ここで進捗を確認できます。オンにすると待機キューを処理します。',
      requeueFailedConfirm:
        '分析に失敗した<strong>{count}</strong>枚を待機キューに戻し、失敗回数をリセットしますか？<br/><br/>自動分析には「AIを有効化」と分析モード「バックグラウンド連続」または「新規画像のみ」が必要です。',
      requeueFailedSuccess: '失敗した{count}枚を待機キューに戻しました。バックグラウンドで処理を開始します',
      requeueFailedSuccessNoAi: '{count}枚を待機キューに戻しました。「AIを有効化」がオフのため自動分析は行われません',
      requeueFailedSuccessNoPump: '{count}枚を待機キューに戻しました。現在の分析モードではバックグラウンド実行されません',
      requeueFailedEmpty: '再キューできる失敗画像はありません'
    },
    utils: {
      clearAiAnalysisData: 'AI分析データをクリア',
      clearAiAnalysisDataConfirm:
        'データベース内の<strong>全画像</strong>のAI分析結果（スコア、要約、タイトル、説明、敏感レベル、タグ、ベクトルなど）をクリアし、<strong>AI推奨（システム）コレクションをすべて削除</strong>します。プラグインのタイトル/説明（メインテーブル）とユーザー作成コレクションは保持します。<br/><br/>自動処理には<strong>AIを有効化</strong>と分析モード「バックグラウンド連続」または「新規画像のみ」が必要です。それ以外は手動分析または設定変更してください。',
      resetAiAnalysisSuccess:
        'ライブラリ内{count}件のAIデータをクリアし、AI推奨コレクション{autoCollections}件を削除しました。バックグラウンド処理を開始します',
      resetAiAnalysisSuccessNoAi:
        '{count}件を待機に戻し、AI推奨コレクション{autoCollections}件を削除しました。「AIを有効化」がオフのため自動分析は行われません',
      resetAiAnalysisSuccessNoPump:
        '{count}件を待機に戻し、AI推奨コレクション{autoCollections}件を削除しました。現在の分析モードではバックグラウンド実行されません',
      resetAiAnalysisEmpty: 'クリアできる画像がありません'
    }
  },
  'ko-KR.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        '백그라운드 분석 타이머가 중지되었습니다(절전 모드로 작업 삭제 후 등). AI 설정을 저장하거나 AC 전원을 연결하세요.',
      pumpBlockReason_power_save_battery: '절전 모드이며 배터리 사용 중 — 백그라운드 분석 일시 중지',
      pumpBlockReason_maintenance: '리소스 유지보수 중 — 분석 일시 중지',
      pumpBlockReason_lock: '분석 대기열이 다른 작업에 사용 중입니다. 잠시 후 다시 시도하세요',
      pumpBlockReason_main_ui_not_ready: '메인 창 준비 중 — 곧 자동으로 시작합니다',
      pumpBlockReason_mode: '현재 분석 모드는 백그라운드에서 자동 실행되지 않습니다',
      pumpBlockReason_disabled: '「AI 사용」이 꺼져 있습니다',
      runStatusDisabled: 'AI 꺼짐',
      runStatusDisabledHint:
        '「AI 사용」이 꺼져 있어 자동 분석이 실행되지 않습니다. 여기서 진행 상황을 볼 수 있으며, 켜면 대기 큐를 처리합니다.',
      requeueFailedConfirm:
        '분석에 실패한 <strong>{count}</strong>장을 대기 큐에 다시 넣고 실패 횟수를 초기화할까요?<br/><br/>자동 분석에는 「AI 사용」과 분석 모드 「백그라운드 연속」 또는 「새 이미지만」이 필요합니다.',
      requeueFailedSuccess: '실패한 {count}장을 대기 큐에 넣었습니다. 백그라운드 처리가 시작됩니다',
      requeueFailedSuccessNoAi: '{count}장을 대기 큐에 넣었습니다. 「AI 사용」이 꺼져 있어 자동 분석되지 않습니다',
      requeueFailedSuccessNoPump: '{count}장을 대기 큐에 넣었습니다. 현재 분석 모드는 백그라운드에서 실행되지 않습니다',
      requeueFailedEmpty: '다시 넣을 실패 이미지가 없습니다'
    },
    utils: {
      clearAiAnalysisData: 'AI 분석 데이터 지우기',
      clearAiAnalysisDataConfirm:
        '데이터베이스 <strong>전체 이미지</strong>의 AI 분석 결과(점수, 요약, 제목, 설명, 민감도, 태그, 벡터 등)를 지우고 <strong>AI 추천(시스템) 컬렉션을 모두 삭제</strong>합니다. 플러그인 제목/설명(메인 테이블)과 사용자 컬렉션은 유지합니다.<br/><br/>자동 처리에는 <strong>AI 사용</strong>과 분석 모드 「백그라운드 연속」 또는 「새 이미지만」이 필요합니다.',
      resetAiAnalysisSuccess:
        '라이브러리 {count}건의 AI 데이터를 지웠고 AI 추천 컬렉션 {autoCollections}개를 삭제했습니다. 백그라운드 처리를 시작합니다',
      resetAiAnalysisSuccessNoAi:
        '{count}건을 대기로 표시하고 AI 추천 컬렉션 {autoCollections}개를 삭제했습니다. 「AI 사용」이 꺼져 있어 자동 분석되지 않습니다',
      resetAiAnalysisSuccessNoPump:
        '{count}건을 대기로 표시하고 AI 추천 컬렉션 {autoCollections}개를 삭제했습니다. 현재 분석 모드는 백그라운드에서 실행되지 않습니다',
      resetAiAnalysisEmpty: '지울 이미지가 없습니다'
    }
  },
  'de-DE.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'Hintergrund-Analyse-Timer gestoppt (oft nach Akku-Energiesparmodus). AI-Einstellungen speichern oder Netzteil anschließen.',
      pumpBlockReason_power_save_battery: 'Energiesparmodus bei Akkubetrieb — Hintergrundanalyse pausiert',
      pumpBlockReason_maintenance: 'Ressourcenwartung läuft — Analyse pausiert',
      pumpBlockReason_lock: 'Analysequelle belegt — bitte kurz warten',
      pumpBlockReason_main_ui_not_ready: 'Hauptfenster noch nicht bereit — startet automatisch',
      pumpBlockReason_mode: 'Aktueller Analysemodus läuft nicht im Hintergrund',
      pumpBlockReason_disabled: '„AI aktivieren“ ist aus',
      runStatusDisabled: 'AI aus',
      runStatusDisabledHint:
        '„AI aktivieren“ ist aus — keine automatische Analyse. Fortschritt bleibt sichtbar; einschalten verarbeitet die Warteschlange.',
      requeueFailedConfirm:
        '<strong>{count}</strong> fehlgeschlagene Bilder erneut in die Warteschlange stellen und Fehlerzähler zurücksetzen?<br/><br/>Automatisch erfordert „AI aktivieren“ und Modus „Hintergrund kontinuierlich“ oder „Nur neue Bilder“.',
      requeueFailedSuccess: '{count} fehlgeschlagene Bilder erneut eingereiht; Hintergrundverarbeitung startet',
      requeueFailedSuccessNoAi: '{count} eingereiht; „AI aktivieren“ ist aus — keine automatische Analyse',
      requeueFailedSuccessNoPump: '{count} eingereiht; aktueller Modus läuft nicht im Hintergrund',
      requeueFailedEmpty: 'Keine fehlgeschlagenen Bilder zum erneuten Einreihen'
    },
    utils: {
      clearAiAnalysisData: 'AI-Analysedaten löschen',
      clearAiAnalysisDataConfirm:
        'AI-Analyseergebnisse (Scores, Zusammenfassungen, Titel, Beschreibungen, Sensibilität, Tags, Vektoren usw.) für <strong>alle Bilder in der Datenbank</strong> löschen und <strong>alle AI-empfohlenen (System-)Sammlungen</strong> entfernen. Plugin-Titel/-Beschreibungen (Haupttabelle) und benutzerdefinierte Sammlungen bleiben.<br/><br/>Automatisch erfordert <strong>AI aktivieren</strong> und Modus „Hintergrund kontinuierlich“ oder „Nur neue Bilder“.',
      resetAiAnalysisSuccess:
        'AI-Daten für {count} Bild(er) gelöscht; {autoCollections} AI-Sammlung(en) entfernt; Hintergrundverarbeitung startet',
      resetAiAnalysisSuccessNoAi:
        '{count} Bild(er) auf ausstehend gesetzt; {autoCollections} AI-Sammlung(en) entfernt; „AI aktivieren“ ist aus',
      resetAiAnalysisSuccessNoPump:
        '{count} Bild(er) auf ausstehend gesetzt; {autoCollections} AI-Sammlung(en) entfernt; aktueller Modus läuft nicht im Hintergrund',
      resetAiAnalysisEmpty: 'Keine Bilder in der Bibliothek zum Löschen'
    }
  },
  'fr-FR.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'Minuteur d’analyse en arrière-plan arrêté (souvent après économie d’énergie sur batterie). Enregistrez les paramètres IA ou branchez sur secteur.',
      pumpBlockReason_power_save_battery: 'Économie d’énergie sur batterie — analyse en arrière-plan en pause',
      pumpBlockReason_maintenance: 'Maintenance des ressources — analyse en pause',
      pumpBlockReason_lock: 'File d’analyse occupée — réessayez dans un instant',
      pumpBlockReason_main_ui_not_ready: 'Fenêtre principale pas encore prête — démarrage automatique imminent',
      pumpBlockReason_mode: 'Le mode d’analyse actuel ne s’exécute pas en arrière-plan',
      pumpBlockReason_disabled: '« Activer l’IA » est désactivé',
      runStatusDisabled: 'IA désactivée',
      runStatusDisabledHint:
        '« Activer l’IA » est désactivé — pas d’analyse automatique. La progression reste visible ici ; activez pour traiter la file d’attente.',
      requeueFailedConfirm:
        'Remettre <strong>{count}</strong> image(s) en échec dans la file d’attente et réinitialiser les échecs ?<br/><br/>Le traitement automatique exige « Activer l’IA » et le mode « Arrière-plan continu » ou « Nouvelles images uniquement ».',
      requeueFailedSuccess: '{count} image(s) remise(s) en file ; traitement en arrière-plan va démarrer',
      requeueFailedSuccessNoAi: '{count} remise(s) en file ; « Activer l’IA » est désactivé',
      requeueFailedSuccessNoPump: '{count} remise(s) en file ; le mode actuel ne s’exécute pas en arrière-plan',
      requeueFailedEmpty: 'Aucune image en échec à remettre en file'
    },
    utils: {
      clearAiAnalysisData: 'Effacer les données d’analyse IA',
      clearAiAnalysisDataConfirm:
        'Effacer les résultats d’analyse IA (scores, résumés, titres, descriptions, sensibilité, tags, vecteurs, etc.) pour <strong>toutes les images de la base</strong> et <strong>supprimer toutes les collections recommandées par l’IA (système)</strong>. Titres/descriptions des plugins (table principale) et collections utilisateur conservés.<br/><br/>Le traitement automatique exige <strong>Activer l’IA</strong> et le mode « Arrière-plan continu » ou « Nouvelles images uniquement ».',
      resetAiAnalysisSuccess:
        'Données IA effacées pour {count} image(s) ; {autoCollections} collection(s) IA supprimée(s) ; traitement en arrière-plan va démarrer',
      resetAiAnalysisSuccessNoAi:
        '{count} image(s) en attente ; {autoCollections} collection(s) IA supprimée(s) ; « Activer l’IA » est désactivé',
      resetAiAnalysisSuccessNoPump:
        '{count} image(s) en attente ; {autoCollections} collection(s) IA supprimée(s) ; le mode actuel ne s’exécute pas en arrière-plan',
      resetAiAnalysisEmpty: 'Aucune image dans la bibliothèque à effacer'
    }
  },
  'es-ES.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'El temporizador de análisis en segundo plano se detuvo (a menudo tras ahorro de energía en batería). Guarda la configuración de IA o conecta la corriente.',
      pumpBlockReason_power_save_battery: 'Ahorro de energía con batería — análisis en segundo plano en pausa',
      pumpBlockReason_maintenance: 'Mantenimiento de recursos — análisis en pausa',
      pumpBlockReason_lock: 'La cola de análisis está ocupada — inténtalo en un momento',
      pumpBlockReason_main_ui_not_ready: 'La ventana principal aún no está lista — comenzará automáticamente',
      pumpBlockReason_mode: 'El modo de análisis actual no se ejecuta en segundo plano',
      pumpBlockReason_disabled: '«Activar IA» está desactivado',
      runStatusDisabled: 'IA desactivada',
      runStatusDisabledHint:
        '«Activar IA» está desactivado — sin análisis automático. El progreso sigue visible aquí; actívalo para procesar la cola.',
      requeueFailedConfirm:
        '¿Volver a encolar <strong>{count}</strong> imagen(es) fallidas y restablecer los contadores de error?<br/><br/>El procesamiento automático requiere «Activar IA» y el modo «Segundo plano continuo» o «Solo imágenes nuevas».',
      requeueFailedSuccess: '{count} imagen(es) reencolada(s); comenzará el procesamiento en segundo plano',
      requeueFailedSuccessNoAi: '{count} reencolada(s); «Activar IA» está desactivado',
      requeueFailedSuccessNoPump: '{count} reencolada(s); el modo actual no se ejecuta en segundo plano',
      requeueFailedEmpty: 'No hay imágenes fallidas para reencolar'
    },
    utils: {
      clearAiAnalysisData: 'Borrar datos de análisis de IA',
      clearAiAnalysisDataConfirm:
        'Borrar resultados de análisis de IA (puntuaciones, resúmenes, títulos, descripciones, sensibilidad, etiquetas, vectores, etc.) de <strong>todas las imágenes de la base de datos</strong> y <strong>eliminar todas las colecciones recomendadas por IA (sistema)</strong>. Se conservan títulos/descripciones de plugins (tabla principal) y colecciones del usuario.<br/><br/>El procesamiento automático requiere <strong>Activar IA</strong> y el modo «Segundo plano continuo» o «Solo imágenes nuevas».',
      resetAiAnalysisSuccess:
        'Datos de IA borrados para {count} imagen(es); eliminadas {autoCollections} colección(es) de IA; comenzará el procesamiento en segundo plano',
      resetAiAnalysisSuccessNoAi:
        '{count} imagen(es) marcadas como pendientes; eliminadas {autoCollections} colección(es) de IA; «Activar IA» está desactivado',
      resetAiAnalysisSuccessNoPump:
        '{count} imagen(es) marcadas como pendientes; eliminadas {autoCollections} colección(es) de IA; el modo actual no se ejecuta en segundo plano',
      resetAiAnalysisEmpty: 'No hay imágenes en la biblioteca para borrar'
    }
  },
  'pt-BR.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'O temporizador de análise em segundo plano parou (muitas vezes após economia de energia na bateria). Salve as configurações de IA ou conecte à tomada.',
      pumpBlockReason_power_save_battery: 'Economia de energia na bateria — análise em segundo plano pausada',
      pumpBlockReason_maintenance: 'Manutenção de recursos — análise pausada',
      pumpBlockReason_lock: 'A fila de análise está ocupada — tente novamente em instantes',
      pumpBlockReason_main_ui_not_ready: 'A janela principal ainda não está pronta — iniciará automaticamente',
      pumpBlockReason_mode: 'O modo de análise atual não roda em segundo plano',
      pumpBlockReason_disabled: '«Ativar IA» está desligado',
      runStatusDisabled: 'IA desligada',
      runStatusDisabledHint:
        '«Ativar IA» está desligado — sem análise automática. O progresso continua visível aqui; ative para processar a fila.',
      requeueFailedConfirm:
        'Recolocar <strong>{count}</strong> imagem(ns) com falha na fila e redefinir as falhas?<br/><br/>O processamento automático exige «Ativar IA» e o modo «Segundo plano contínuo» ou «Somente imagens novas».',
      requeueFailedSuccess: '{count} imagem(ns) recolocada(s) na fila; o processamento em segundo plano vai iniciar',
      requeueFailedSuccessNoAi: '{count} recolocada(s) na fila; «Ativar IA» está desligado',
      requeueFailedSuccessNoPump: '{count} recolocada(s) na fila; o modo atual não roda em segundo plano',
      requeueFailedEmpty: 'Não há imagens com falha para recolocar na fila'
    },
    utils: {
      clearAiAnalysisData: 'Limpar dados de análise de IA',
      clearAiAnalysisDataConfirm:
        'Limpar resultados de análise de IA (notas, resumos, títulos, descrições, sensibilidade, tags, vetores etc.) de <strong>todas as imagens do banco</strong> e <strong>excluir todas as coleções recomendadas por IA (sistema)</strong>. Títulos/descrições de plugins (tabela principal) e coleções do usuário são mantidos.<br/><br/>O processamento automático exige <strong>Ativar IA</strong> e o modo «Segundo plano contínuo» ou «Somente imagens novas».',
      resetAiAnalysisSuccess:
        'Dados de IA limpos para {count} imagem(ns); {autoCollections} coleção(ões) de IA removida(s); o processamento em segundo plano vai iniciar',
      resetAiAnalysisSuccessNoAi:
        '{count} imagem(ns) marcadas como pendentes; {autoCollections} coleção(ões) de IA removida(s); «Ativar IA» está desligado',
      resetAiAnalysisSuccessNoPump:
        '{count} imagem(ns) marcadas como pendentes; {autoCollections} coleção(ões) de IA removida(s); o modo atual não roda em segundo plano',
      resetAiAnalysisEmpty: 'Não há imagens na biblioteca para limpar'
    }
  },
  'it-IT.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'Il timer di analisi in background è stato arrestato (spesso dopo risparmio energetico a batteria). Salva le impostazioni IA o collega l’alimentazione.',
      pumpBlockReason_power_save_battery: 'Risparmio energetico a batteria — analisi in background in pausa',
      pumpBlockReason_maintenance: 'Manutenzione risorse — analisi in pausa',
      pumpBlockReason_lock: 'La coda di analisi è occupata — riprova tra poco',
      pumpBlockReason_main_ui_not_ready: 'Finestra principale non ancora pronta — avvio automatico a breve',
      pumpBlockReason_mode: 'La modalità di analisi attuale non viene eseguita in background',
      pumpBlockReason_disabled: '«Abilita IA» è disattivato',
      runStatusDisabled: 'IA disattivata',
      runStatusDisabledHint:
        '«Abilita IA» è disattivato — nessuna analisi automatica. I progressi restano visibili qui; attivala per elaborare la coda.',
      requeueFailedConfirm:
        'Rimettere in coda <strong>{count}</strong> immagine/i fallite e azzerare i contatori errori?<br/><br/>L’elaborazione automatica richiede «Abilita IA» e la modalità «Background continuo» o «Solo nuove immagini».',
      requeueFailedSuccess: '{count} immagine/i rimessa/e in coda; l’elaborazione in background partirà',
      requeueFailedSuccessNoAi: '{count} rimessa/e in coda; «Abilita IA» è disattivato',
      requeueFailedSuccessNoPump: '{count} rimessa/e in coda; la modalità attuale non viene eseguita in background',
      requeueFailedEmpty: 'Nessuna immagine fallita da rimettere in coda'
    },
    utils: {
      clearAiAnalysisData: 'Cancella dati analisi IA',
      clearAiAnalysisDataConfirm:
        'Cancella i risultati di analisi IA (punteggi, riepiloghi, titoli, descrizioni, sensibilità, tag, vettori ecc.) per <strong>tutte le immagini nel database</strong> e <strong>elimina tutte le raccolte consigliate dall’IA (sistema)</strong>. Titoli/descrizioni plugin (tabella principale) e raccolte utente restano.<br/><br/>L’elaborazione automatica richiede <strong>Abilita IA</strong> e la modalità «Background continuo» o «Solo nuove immagini».',
      resetAiAnalysisSuccess:
        'Dati IA cancellati per {count} immagine/i; rimosse {autoCollections} raccolta/e IA; l’elaborazione in background partirà',
      resetAiAnalysisSuccessNoAi:
        '{count} immagine/i in attesa; rimosse {autoCollections} raccolta/e IA; «Abilita IA» è disattivato',
      resetAiAnalysisSuccessNoPump:
        '{count} immagine/i in attesa; rimosse {autoCollections} raccolta/e IA; la modalità attuale non viene eseguita in background',
      resetAiAnalysisEmpty: 'Nessuna immagine nella libreria da cancellare'
    }
  },
  'ru-RU.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'Таймер фонового анализа остановлен (часто после энергосбережения на батарее). Сохраните настройки ИИ или подключите питание от сети.',
      pumpBlockReason_power_save_battery: 'Энергосбережение на батарее — фоновый анализ приостановлен',
      pumpBlockReason_maintenance: 'Обслуживание ресурсов — анализ приостановлен',
      pumpBlockReason_lock: 'Очередь анализа занята — повторите позже',
      pumpBlockReason_main_ui_not_ready: 'Главное окно ещё не готово — запуск произойдёт автоматически',
      pumpBlockReason_mode: 'Текущий режим анализа не выполняется в фоне',
      pumpBlockReason_disabled: '«Включить ИИ» отключено',
      runStatusDisabled: 'ИИ выкл.',
      runStatusDisabledHint:
        '«Включить ИИ» отключено — автоматический анализ не выполняется. Прогресс виден здесь; включите для обработки очереди.',
      requeueFailedConfirm:
        'Вернуть <strong>{count}</strong> изображ. с ошибкой в очередь и сбросить счётчики ошибок?<br/><br/>Автоматическая обработка требует «Включить ИИ» и режим «Фон непрерывно» или «Только новые».',
      requeueFailedSuccess: '{count} изображ. возвращено в очередь; начнётся фоновая обработка',
      requeueFailedSuccessNoAi: '{count} в очереди; «Включить ИИ» отключено — автоматический анализ не выполняется',
      requeueFailedSuccessNoPump: '{count} в очереди; текущий режим не выполняется в фоне',
      requeueFailedEmpty: 'Нет изображений с ошибкой для повторной постановки в очередь'
    },
    utils: {
      clearAiAnalysisData: 'Очистить данные анализа ИИ',
      clearAiAnalysisDataConfirm:
        'Очистить результаты анализа ИИ (оценки, сводки, заголовки, описания, уровень чувствительности, теги, векторы и т.д.) для <strong>всех изображений в базе</strong> и <strong>удалить все рекомендованные ИИ (системные) коллекции</strong>. Заголовки/описания плагинов (основная таблица) и пользовательские коллекции сохраняются.<br/><br/>Автоматическая обработка требует <strong>Включить ИИ</strong> и режим «Фон непрерывно» или «Только новые».',
      resetAiAnalysisSuccess:
        'Данные ИИ очищены для {count} изображ.; удалено {autoCollections} рекоменд. коллекций ИИ; начнётся фоновая обработка',
      resetAiAnalysisSuccessNoAi:
        '{count} изображ. помечены как ожидающие; удалено {autoCollections} коллекций ИИ; «Включить ИИ» отключено',
      resetAiAnalysisSuccessNoPump:
        '{count} изображ. помечены как ожидающие; удалено {autoCollections} коллекций ИИ; текущий режим не выполняется в фоне',
      resetAiAnalysisEmpty: 'В библиотеке нет изображений для очистки'
    }
  },
  'ar-SA.json': {
    ai: {
      pumpBlockReason_scheduler_stopped:
        'توقّ مؤقت التحليل في الخلفية (غالباً بعد وضع توفير الطاقة على البطارية). احفظ إعدادات الذكاء الاصطناعي أو وصّل التيار.',
      pumpBlockReason_power_save_battery: 'وضع توفير الطاقة على البطارية — التحليل في الخلفية متوقف',
      pumpBlockReason_maintenance: 'صيانة الموارد جارية — التحليل متوقف',
      pumpBlockReason_lock: 'قائمة التحليل مشغولة — حاول بعد قليل',
      pumpBlockReason_main_ui_not_ready: 'النافذة الرئيسية غير جاهزة بعد — سيبدأ تلقائياً',
      pumpBlockReason_mode: 'وضع التحليل الحالي لا يعمل في الخلفية',
      pumpBlockReason_disabled: '«تفعيل الذكاء الاصطناعي» متوقف',
      runStatusDisabled: 'الذكاء الاصطناعي متوقف',
      runStatusDisabledHint:
        '«تفعيل الذكاء الاصطناعي» متوقف — لا تحليل تلقائي. يبقى التقدم ظاهراً هنا؛ فعّله لمعالجة قائمة الانتظار.',
      requeueFailedConfirm:
        'إعادة <strong>{count}</strong> صورة فاشلة إلى قائمة الانتظار وإعادة تعيين عدادات الفشل؟<br/><br/>المعالجة التلقائية تتطلب «تفعيل الذكاء الاصطناعي» ووضع «خلفية مستمرة» أو «صور جديدة فقط».',
      requeueFailedSuccess: 'أُعيدت {count} صورة إلى قائمة الانتظار؛ ستبدأ المعالجة في الخلفية',
      requeueFailedSuccessNoAi: 'أُعيدت {count} صورة؛ «تفعيل الذكاء الاصطناعي» متوقف',
      requeueFailedSuccessNoPump: 'أُعيدت {count} صورة؛ الوضع الحالي لا يعمل في الخلفية',
      requeueFailedEmpty: 'لا توجد صور فاشلة لإعادة الإدراج'
    },
    utils: {
      clearAiAnalysisData: 'مسح بيانات تحليل الذكاء الاصطناعي',
      clearAiAnalysisDataConfirm:
        'مسح نتائج تحليل الذكاء الاصطناعي (الدرجات، الملخصات، العناوين، الأوصاف، مستوى الحساسية، الوسوم، المتجهات، إلخ) لـ<strong>كل الصور في قاعدة البيانات</strong> و<strong>حذف كل المجموعات الموصى بها بالذكاء الاصطناعي (النظامية)</strong>. تبقى عناوين/أوصاف الإضافات (الجدول الرئيسي) ومجموعات المستخدم.<br/><br/>المعالجة التلقائية تتطلب <strong>تفعيل الذكاء الاصطناعي</strong> ووضع «خلفية مستمرة» أو «صور جديدة فقط».',
      resetAiAnalysisSuccess:
        'تم مسح بيانات الذكاء الاصطناعي لـ {count} صورة؛ حُذفت {autoCollections} مجموعة موصى بها؛ ستبدأ المعالجة في الخلفية',
      resetAiAnalysisSuccessNoAi:
        'تم وضع {count} صورة قيد الانتظار؛ حُذفت {autoCollections} مجموعة؛ «تفعيل الذكاء الاصطناعي» متوقف',
      resetAiAnalysisSuccessNoPump:
        'تم وضع {count} صورة قيد الانتظار؛ حُذفت {autoCollections} مجموعة؛ الوضع الحالي لا يعمل في الخلفية',
      resetAiAnalysisEmpty: 'لا توجد صور في المكتبة للمسح'
    }
  }
}

function applyPatch(file, data) {
  const root = JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'))
  const ai = root.pages?.Setting?.aiSetting
  const utils = root.pages?.Utils
  if (!ai || !utils) throw new Error(`${file}: missing pages.Setting.aiSetting or pages.Utils`)

  Object.assign(ai, data.ai)
  Object.assign(utils, data.utils)

  if (data.twFix) {
    Object.assign(ai, {
      statFailedHint: data.twFix.statFailedHint,
      statEmbeddingLabel: data.twFix.statEmbeddingLabel,
      analysisConcurrency: data.twFix.analysisConcurrency,
      analysisConcurrencyHint: data.twFix.analysisConcurrencyHint,
      textEmbedModelHint: data.twFix.textEmbedModelHint
    })
    if (ai.errors && data.twFix['errors.modelNameMissing']) {
      ai.errors.modelNameMissing = data.twFix['errors.modelNameMissing']
    }
  }

  fs.writeFileSync(path.join(langDir, file), `${JSON.stringify(root, null, 2)}\n`, 'utf8')
  console.log('patched', file)
}

for (const [file, data] of Object.entries(translations)) {
  applyPatch(file, data)
}

console.log('done')
