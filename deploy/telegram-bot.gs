/**
 * Людка (@LyudmilaVitalievnaBot) on Google Apps Script. Two jobs:
 *
 * 1. Relay for contact.php (doPost): the hosting can't reach api.telegram.org, but it can reach Google.
 *    contact.php sends the bot token with each request; the relay can only call sendMessage.
 *    Deployed as a web app (execute as "Me", access "Anyone"); its /exec URL is the TELEGRAM_RELAY_URL secret.
 *    Editing this file doesn't change the deployed web app, so the relay URL stays the same.
 *
 * 2. Group bot (poll, every minute by a trigger): replies to swearing and to messages addressed to her.
 *    Needs the BOT_TOKEN script property (Project Settings → Script Properties) and a one-time run of setup().
 *    Telegram privacy mode must stay disabled (/setprivacy → Disable), otherwise she doesn't see group messages.
 */

const SWEAR_REPLY = 'ай-ай-ай! как не стыдно!';
const MENTION_REPLY = 'ответила в директ!';

// Checked against each word after normalization (lowercase, ё → е, latin lookalikes → cyrillic, no repeated letters).
const SWEAR_PATTERNS = [
  /ху[йяеию]/,
  /пизд/,
  /^(за|на|по|от|отъ|вы|при|про|у|раз|разъ|до|недо|пере|под|подъ|об|съ|въ|изъ|вз|долбо)?еб(а|у|л|н|ш|с|о|и|е|к|$)/,
  /^бля/,
  /^сук(а|и|у|е|ой|ам|ами|ах|ин.*)$/,
  /^муд(ак|ил|оз|ач)/,
  /^п[ие]д[оа]?р/,
  /^г[ао]нд[оа]н/,
  /^шлюх/,
  /^залуп/,
  /^манд(а|ы|у|е|ой)$/,
];

// Words that contain a pattern above but aren't swearing.
const SWEAR_EXCEPTIONS = [/страху/, /^рубля/, /^корабля/];

// "Людка", "Люда", "Людочка", "Людмила Витальевна"…
const NAME_PATTERN = /^(людк[аеиоуы].*|люд[ауеы]|людой|людочк.*|людмил.*)$/;

const LOOKALIKES = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', y: 'у', x: 'х', k: 'к', m: 'м', h: 'н', t: 'т', b: 'в' };

function doPost(e) {
  const p = e.parameter;
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + p.token + '/sendMessage', {
    method: 'post',
    payload: { chat_id: p.chat_id, text: p.text, disable_web_page_preview: 'true' },
    muteHttpExceptions: true,
  });

  return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
}

// Run once by hand: remembers the bot, skips old messages and starts the every-minute trigger.
function setup() {
  const props = PropertiesService.getScriptProperties();
  const me = api('getMe', {});
  props.setProperties({ BOT_ID: String(me.id), BOT_USERNAME: me.username.toLowerCase() });

  // Polling doesn't work while a webhook is set.
  api('deleteWebhook', {});
  // Don't answer messages sent before the bot was switched on.
  const last = api('getUpdates', { offset: -1 });
  props.setProperty('OFFSET', String(last.length ? last[0].update_id + 1 : 0));

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'poll')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('poll').timeBased().everyMinutes(1).create();

  Logger.log('Готово: @' + me.username + ' проверяет сообщения раз в минуту.');
}

// Short polls once a minute: free Apps Script accounts get 90 minutes of trigger time a day.
function poll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const updates = api('getUpdates', {
      offset: Number(props.getProperty('OFFSET') || 0),
      allowed_updates: JSON.stringify(['message']),
    });
    updates.forEach((update) => {
      // Saved first, so a message that breaks handling isn't retried forever.
      props.setProperty('OFFSET', String(update.update_id + 1));
      if (update.message) {
        handleMessage(update.message, props);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function handleMessage(message, props) {
  const text = message.text || message.caption || '';
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
  if (!text || !isGroup || (message.from && message.from.is_bot)) {
    return;
  }

  if (hasSwearing(text)) {
    reply(message, SWEAR_REPLY);
  } else if (isAddressedToBot(message, text, props)) {
    reply(message, MENTION_REPLY);
  }
}

function hasSwearing(text) {
  return words(text).some(
    (word) =>
      SWEAR_PATTERNS.some((pattern) => pattern.test(word)) &&
      !SWEAR_EXCEPTIONS.some((pattern) => pattern.test(word))
  );
}

function isAddressedToBot(message, text, props) {
  const botId = Number(props.getProperty('BOT_ID'));
  const repliedToBot = message.reply_to_message && (message.reply_to_message.from || {}).id === botId;
  const mentioned = text.toLowerCase().indexOf('@' + props.getProperty('BOT_USERNAME')) !== -1;

  return repliedToBot || mentioned || words(text).some((word) => NAME_PATTERN.test(word));
}

function words(text) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[a-z]/g, (letter) => LOOKALIKES[letter] || letter)
    .split(/[^а-я]+/)
    .filter(Boolean)
    .map((word) => word.replace(/(.)\1+/g, '$1'));
}

function reply(message, text) {
  api('sendMessage', {
    chat_id: message.chat.id,
    text: text,
    reply_parameters: JSON.stringify({ message_id: message.message_id, allow_sending_without_reply: true }),
  });
}

function api(method, params) {
  const token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post',
    payload: params,
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) {
    throw new Error(method + ': ' + result.description);
  }
  return result.result;
}
