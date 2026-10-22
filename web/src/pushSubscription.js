export function decodeVapidKey(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{86,88}$/.test(value))throw new Error('A valid public VAPID key is required.')
 const base64=value.replace(/-/g,'+').replace(/_/g,'/')
 const raw=atob(base64.padEnd(Math.ceil(base64.length/4)*4,'='))
 const bytes=Uint8Array.from(raw,char=>char.charCodeAt(0))
 if(bytes.length!==65||bytes[0]!==4)throw new Error('Invalid VAPID public key format.')
 return bytes
}
export function encodePushKey(buffer){
 const bytes=new Uint8Array(buffer)
 let raw=''
 for(const b of bytes)raw+=String.fromCharCode(b)
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
export function serializePushSubscription(subscription,userId){
 const json=subscription.toJSON()
 if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth||!userId)throw new Error('Incomplete push subscription')
 if(!/^https:\/\//.test(json.endpoint))throw new Error('Push endpoint must use HTTPS')
 return {user_id:userId,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_secret:json.keys.auth}
}
