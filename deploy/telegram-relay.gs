/**
 * Telegram relay for contact.php: the hosting can't reach api.telegram.org, but it can reach Google.
 *
 * Setup: script.google.com → New project → paste this file → Deploy → New deployment →
 * type "Web app", execute as "Me", access "Anyone" → copy the /exec URL into the
 * TELEGRAM_RELAY_URL secret.
 *
 * The relay stores nothing: contact.php sends the bot token with each request,
 * and the relay can only call sendMessage.
 */
function doPost(e) {
  var p = e.parameter;
  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + p.token + '/sendMessage', {
    method: 'post',
    payload: {
      chat_id: p.chat_id,
      text: p.text,
      disable_web_page_preview: 'true',
    },
    muteHttpExceptions: true,
  });

  return ContentService.createTextOutput(response.getContentText()).setMimeType(ContentService.MimeType.JSON);
}
