const {chromium}=require('C:/Users/HP/Desktop/1_ECOSISTEMA_ENSUTEX/02_Sitio_Web_Definitivo/node_modules/playwright');
module.exports={chromium:{launch:(options={})=>chromium.launch({...options,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})}};
