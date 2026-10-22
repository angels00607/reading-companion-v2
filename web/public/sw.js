const PREFIX='/reading-companion-v2/'
self.addEventListener('install',event=>{self.skipWaiting()})
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())})
self.addEventListener('push',event=>{
 let data={}
 try{data=event.data?.json()||{}}catch{data={}}
 const title=typeof data.title==='string'&&data.title.length<120?data.title:'Reading Companion'
 const body=typeof data.body==='string'?data.body.slice(0,240):'A book on your reading list has an update.'
 const tag=typeof data.tag==='string'?data.tag.slice(0,120):'reading-companion'
 event.waitUntil(self.registration.showNotification(title,{body,tag,icon:PREFIX+'icon.svg',data:{url:PREFIX}}))
})
self.addEventListener('notificationclick',event=>{
 event.notification.close()
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  const existing=windows.find(client=>new URL(client.url).pathname.startsWith(PREFIX))
  if(existing){await existing.focus();return}
  await self.clients.openWindow(PREFIX)
 })())
})
