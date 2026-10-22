import test from 'node:test'
import assert from 'node:assert/strict'
import {decodeVapidKey,serializePushSubscription} from '../src/pushSubscription.js'
test('rejects absent or malformed public VAPID keys',()=>{assert.throws(()=>decodeVapidKey(''));assert.throws(()=>decodeVapidKey('private-secret'))})
test('serializes subscription keys and ownership without leaking extra data',()=>{const row=serializePushSubscription({toJSON:()=>({endpoint:'https://push.example/device',keys:{p256dh:'public-key',auth:'auth-key'},expirationTime:null})},'user-1');assert.deepEqual(row,{user_id:'user-1',endpoint:'https://push.example/device',p256dh:'public-key',auth_secret:'auth-key'})})
test('rejects incomplete and insecure endpoints',()=>{assert.throws(()=>serializePushSubscription({toJSON:()=>({endpoint:'http://bad',keys:{p256dh:'a',auth:'b'}})},'user-1'));assert.throws(()=>serializePushSubscription({toJSON:()=>({endpoint:'https://push.example',keys:{}})},'user-1'))})
