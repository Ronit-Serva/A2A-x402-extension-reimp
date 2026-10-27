const $ = id => document.getElementById(id);
let state = {}, run, selected = '', token = '', pendingAction = false, autoScroll = true, lastSession = '';
let transientPayload, transientRunId = '';
let logEvents = [], lastLogId = 0, configKey = '', servicesKey = '', setupKey = '', runKey = '';
const explanations = [
  ['Read AgentCard', 'client', 'chain', 'card-read', 'The client reads the AgentCard contract on the local blockchain. It validates the active flag, service URL, capability, network, token, recipient, and price. This is retrieval at a known address.'],
  ['Request service', 'client', 'server', 'unpaid-request', 'The official A2A SDK sends a JSON-RPC SendMessage request with the numbers you entered. No payment is attached, so the server must not compute the service result.'],
  ['HTTP 402 · payment required', 'server', 'client', 'challenge', 'The server returns HTTP 402 and the PAYMENT-REQUIRED header. The challenge describes the exact payment terms. This response does not transfer tokens or execute the statistics service.'],
  ['Check terms & sign authorization', 'client', 'client', 'signed', 'The client compares the challenge with its on-chain AgentCard and spending budget, then signs an EIP-3009 authorization. The dashboard reveals the complete signed payload only in a temporary live view. Signing alone does not transfer tokens.'],
  ['Retry request with payment', 'client', 'server', 'paid-retry', 'The client retries the same A2A message with PAYMENT-SIGNATURE. The temporary payload view clears as the request is sent. The signature authorizes a transfer; application state associates it with this request.'],
  ['Verify payment', 'server', 'facilitator', 'verifying', 'The server calls the separate facilitator’s /verify endpoint. Verification checks the signature and configured terms using the actual SDK. It does not reserve funds or submit a transaction.'],
  ['Authorization is valid', 'facilitator', 'server', 'verified', 'The facilitator reports a valid authorization. This is permission to attempt settlement, not a confirmed payment. The facilitator independently checks the terms again during settlement.'],
  ['Settle payment', 'server', 'facilitator', 'settling', 'The server calls /settle. Durable records associate the payer and nonce with this attempt. Matching retries reconcile the same transaction rather than creating a fresh authorization.'],
  ['Submit token transfer', 'facilitator', 'chain', 'submitted', 'The facilitator signs and broadcasts transferWithAuthorization, paying native ETH gas from its own account. The token recipient is the AgentCard contract. A transaction hash by itself is not confirmation.'],
  ['Transfer confirmed', 'chain', 'facilitator', 'confirmed', 'The facilitator reads the transaction receipt and checks both Transfer and AuthorizationUsed events. The dashboard independently queries that receipt. Hardhat can mine immediately; there is no artificial wait animation.'],
  ['Settlement result & transaction', 'facilitator', 'server', 'paid', 'The server receives the confirmed settlement receipt and persists paid state. The next manual checkpoint permits service computation. Pending or unknown settlement cannot reach that checkpoint.'],
  ['Service result & payment receipt', 'server', 'client', 'result', 'After confirmed payment, the server executes the statistics service and stores its result. The client receives the real A2A response and PAYMENT-RESPONSE receipt. Live balances and the transaction events provide separate on-chain evidence.'],
];
const checkpoints = {
  'read-card': ['Read the on-chain AgentCard', 'Inspect the service advertisement directly from the deployed contract before sending any request.', 'Read AgentCard', 0],
  'unpaid-request': ['Send the unpaid service request', 'Ask the server to calculate your numbers. It should return HTTP 402 without computing or moving tokens.', 'Send unpaid request', 1],
  authorize: ['Review the terms, then sign', 'The challenge has been checked against the on-chain card. Signing authorizes 2 TestUSD to the AgentCard contract; it does not submit a transaction.', 'Sign authorization', 3],
  'paid-retry': ['Send the signed payment proof', 'The client has signed locally. Retry the same request with PAYMENT-SIGNATURE. No new signature is created by this action.', 'Retry with payment', 4],
  verify: ['Let the facilitator verify', 'The server has received the paid retry. Continue to check its authorization through the separate facilitator. Verification does not move tokens.', 'Verify payment', 5],
  settle: ['Submit the real token transfer', 'Verification succeeded. Continue to let the facilitator settle 2 TestUSD and pay transaction gas. Once submitted, a transaction cannot be undone from this page.', 'Settle 2 TestUSD', 7],
  execute: ['Payment confirmed. Run the service.', 'The server has persisted a successful settlement receipt. Continue to execute the statistics service and return the final response.', 'Execute & receive result', 10],
};
const fields = [
  ['chainId','Expected blockchain identifier. The local network uses 31337.'],['rpcUrl','Local JSON-RPC endpoint used to read and submit chain operations.'],['counter','Auxiliary contract used by the fixture’s basic execution check.'],['token','TestUSD ERC-20 / EIP-3009 token contract.'],['agentCard','On-chain AgentCard metadata and recipient of token payments.'],['owner','Local deployment and contract administration account.'],['client','Public payer address. Its key belongs only to the client process.'],['facilitator','Public settlement signer, funded with ETH for gas.'],['fixtureClientBalance','Historical client balance after fixture restoration, in base units.'],['fixtureCardBalance','Historical recipient balance after fixture restoration, in base units.'],['settledClientBalance','Historical client balance during the fixture settlement check.'],['settledCardBalance','Historical recipient balance during the fixture settlement check.'],['paymentTxHash','Fixture payment-check transaction. This is not the current walkthrough’s receipt.'],['receiptStatus','Recorded status of the fixture payment-check receipt.'],['anchor.blockNumber','Block number identifying this seeded deployment instance.'],['anchor.blockHash','Expected hash at that block; detects stale metadata after a reset.'],['tokenDomain.name','Name in the EIP-712 signing domain.'],['tokenDomain.version','Version in the EIP-712 signing domain.'],['tokenDomain.decimals','Display precision: 2,000,000 base units = 2 TestUSD with six decimals.'],['codeHashes.token','Expected runtime bytecode hash of the token contract.'],['codeHashes.agentCard','Expected runtime bytecode hash of the AgentCard contract.'],
];
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function notice(message) { $('notice').hidden = !message; $('notice').textContent = message || ''; }
function pretty(data) { return JSON.stringify(data, null, 2); }
function amount(value, decimals = 6) { if (value === undefined) return '—'; const n = BigInt(value); const base = 10n ** BigInt(decimals); const fraction = (n % base).toString().padStart(decimals, '0').replace(/0+$/, ''); return `${n / base}${fraction ? '.' + fraction : ''}`; }
function rows(target, data) { target.replaceChildren(); target.className = ''; for (const [label, value] of data) { const row = element('div', undefined, 'data-row'); row.append(element('span', label), element('code', String(value ?? '—'))); target.append(row); } }
function blank(target, text) { target.className = 'empty-state'; target.textContent = text; }
async function api(url, body) {
  const response = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-dashboard-token': token }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data;
}
async function perform(task) {
  if (pendingAction) return;
  pendingAction = true; notice(''); renderControls();
  try { await task(); await poll(); await loadRun(); } catch (error) { notice(error.message); }
  finally { pendingAction = false; renderControls(); }
}
const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attributes = {}, text) { const node = document.createElementNS(svgNS, tag); Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key, value)); if (text) node.textContent = text; return node; }
function drawDiagram() {
  const diagram = $('diagram');
  const defs = svg('defs');
  const marker = svg('marker', { id:'arrow', viewBox:'0 0 10 10', refX:9, refY:5, markerWidth:6, markerHeight:6, orient:'auto-start-reverse', markerUnits:'strokeWidth' });
  marker.append(svg('path', { d:'M 0 0 L 10 5 L 0 10 z', fill:'context-stroke' })); defs.append(marker); diagram.append(defs);
  const x = { client:70, server:265, facilitator:455, chain:650 };
  const colors = { client:'#e8f1f0',server:'#ebf2e5',facilitator:'#f8f0e3',chain:'#f0ecf5' };
  for (const [actor, label] of [['client','Client'],['server','Server'],['facilitator','Facilitator'],['chain','Local chain']]) {
    diagram.append(svg('line',{x1:x[actor],x2:x[actor],y1:49,y2:662,class:'lifeline'}));
    diagram.append(svg('rect',{x:x[actor]-53,y:14,width:106,height:34,rx:6,fill:colors[actor]}));
    diagram.append(svg('text',{x:x[actor],y:35,'text-anchor':'middle',class:'actor-text'},label));
  }
  explanations.forEach(([label,from,to],index) => {
    const y = 89 + index * 49;
    const group = svg('g',{class:'arrow-group',id:`arrow-${index}`,tabindex:0,role:'button','aria-label':`${index+1}. ${label}`});
    group.append(svg('rect',{x:10,y:y-25,width:700,height:46,rx:5,class:'step-bg'}));
    const isReturn = [2,6,9,10,11].includes(index);
    if (from === to) group.append(svg('path',{d:`M ${x[from]} ${y} C ${x[from]+90} ${y-12}, ${x[from]+90} ${y+25}, ${x[from]} ${y+15}`,fill:'none',class:'arrow-line','marker-end':'url(#arrow)'}));
    else group.append(svg('line',{x1:x[from],x2:x[to],y1:y,y2:y,class:'arrow-line','marker-end':'url(#arrow)',...(isReturn?{'stroke-dasharray':'4 4'}:{})}));
    group.append(svg('text',{x:from===to?x[from]+110:(x[from]+x[to])/2,y:y-10,'text-anchor':from===to?'start':'middle',class:'step-label'},label));
    group.addEventListener('click',()=>explain(index)); group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();explain(index);}});
    diagram.append(group);
    const li=element('li'); const button=element('button',label);button.addEventListener('click',()=>explain(index));li.append(button);$('sequence-list').append(li);
  });
}
function explain(index) {
  const [label,,,type,copy] = explanations[index];
  $('explanation-title').textContent=label;$('explanation-copy').textContent=copy;
  const observed=run?.events?.filter(event=>event.type===type);
  $('explanation-data').textContent=observed?.length ? pretty(observed) : 'No matching execution event observed in this run yet.';
  $('explanation').showModal();
}
function renderServices() {
  const key=JSON.stringify([state.processes,state.deployment?.valid,pendingAction,state.busy,state.activeRun?.id]); if(key===servicesKey)return;servicesKey=key;
  const fragment=document.createDocumentFragment();
  for(const [name,label,endpoint] of [['node','Local blockchain',':8545 / Hardhat'],['deploy','Contract deployment','TestUSD + AgentCard'],['facilitator','Facilitator',':4022 / x402'],['server','Server agent',':4021 / A2A']]) {
    const item=state.processes?.[name]||{};const ready=name==='deploy'?state.deployment?.valid:item.ready;
    const card=element('article',undefined,'service-card');const content=element('div');content.append(element('h3',label),element('p',endpoint),element('span',ready?(name==='deploy'?'Validated':`Ready · ${item.ownership}`):item.state==='running'?'Starting / checking':item.occupied?'Port occupied / unhealthy':'Not running',`status ${ready?'ready':item.occupied?'error':''}`));card.append(content);
    if(item.ownership==='dashboard'&&name!=='deploy'){const button=element('button','Stop');button.disabled=!!state.activeRun||state.busy||pendingAction;button.addEventListener('click',()=>perform(()=>api(`/api/processes/${name}/stop`,{})));card.append(button);}fragment.append(card);
  }
  $('services').replaceChildren(fragment);
}
function renderSetup(){
  const p=state.processes||{};const key=JSON.stringify([p.node?.ready,state.runtime,p.compile?.state,p.deploy?.state,state.deployment?.valid,p.facilitator,p.server,state.busy,!!state.activeRun,pendingAction]);if(key===setupKey)return;setupKey=key;
  const items=[['node','Start blockchain','Hardhat · chain ID 31337',p.node?.ready,!p.node?.occupied],['compile','Compile contracts','Pinned solc-js compiler',state.runtime?.compiled,true],['deploy','Deploy & seed fixture','Includes checks; restores 100 / 0',state.deployment?.valid,p.node?.ready&&state.runtime?.compiled&&!p.server?.occupied&&!p.facilitator?.occupied],['facilitator','Start facilitator','Separate process · pays gas',p.facilitator?.ready,state.deployment?.valid&&!p.facilitator?.occupied],['server','Start server agent','A2A endpoint · payment gate',p.server?.ready,state.deployment?.valid&&p.facilitator?.ready&&!p.server?.occupied]];
  const fragment=document.createDocumentFragment();items.forEach(([name,title,desc,done,enabled],i)=>{const li=element('li',undefined,done?'done':'');li.append(element('span',done?'✓':String(i+1),'step-number'));const body=element('div',undefined,'setup-body');body.append(element('h3',title),element('p',desc));const running=p[name]?.state==='running';const button=element('button',running&&!done?'Running…':done?(name==='compile'?'Compile again':name==='deploy'?'Deploy again':'Ready'):name==='deploy'?'Deploy fixture':name==='compile'?'Compile':'Start');button.disabled=!enabled||pendingAction||state.busy||!!state.activeRun||(done&&!['compile','deploy'].includes(name));button.addEventListener('click',()=>perform(()=>api(`/api/actions/${name}`,{})));body.append(button);li.append(body);fragment.append(li);});$('setup').replaceChildren(fragment);
}
function renderControls(){
  const p=state.processes||{};
  $('start-run').disabled=pendingAction||state.busy||!!state.activeRun||!state.deployment?.valid||!p.server?.ready||!p.facilitator?.ready;
  const proofViewMissing=run?.checkpoint?.stage==='paid-retry'&&run.events?.some(event=>event.type==='signed')&&transientRunId!==selected;
  $('continue').disabled=pendingAction||!run?.checkpoint||state.activeRun?.id!==selected||Date.now()>=run.checkpoint.expiresAt||proofViewMissing;
  $('cancel').hidden=!run||state.activeRun?.id!==selected;$('cancel').disabled=pendingAction;
  $('close-outcome').hidden=!run||run.resolved||!!state.activeRun||run.status==='complete'||!['failed','paid-undelivered','completed'].includes(run.evidence?.applicationStatus);$('close-outcome').disabled=pendingAction;
  $('download-evidence').disabled=!run;
}
function renderRun(){
  $('run-badge').textContent=run?run.status.toUpperCase():'AWAITING RUN';
  $('run-state').textContent=run?`${run.id}\n${run.status}`:'Your next run will appear here.';
  const point=run?.checkpoint;const detail=point?checkpoints[point.stage]:undefined;
  if(detail){$('next-label').textContent='WAITING FOR YOU';$('next-title').textContent=detail[0];$('next-description').textContent=point.stage==='paid-retry'&&run?.events?.some(event=>event.type==='signed')&&transientRunId!==selected?'The signed payload was cleared from this browser session. It is not saved and cannot be reopened. Cancel this attempt before starting another if you need to inspect a fresh signature.':detail[1];$('continue').textContent=detail[2];}
  else if(run?.status==='complete'){$('next-label').textContent='EXCHANGE COMPLETE';$('next-title').textContent='Payment settled. Response received.';$('next-description').textContent='Inspect the real result, receipt, and token events. A new walkthrough creates a new request and costs another 2 TestUSD.';}
  else if(run?.error){$('next-label').textContent='ATTEMPT INTERRUPTED';$('next-title').textContent='Inspect the payment state';$('next-description').textContent=run.error;}
  else if(run){$('next-label').textContent='EXECUTING';$('next-title').textContent='The processes are working';$('next-description').textContent='Follow live events below. The next checkpoint will appear here when reached.';}
  else{$('next-label').textContent='READY WHEN YOU ARE';$('next-title').textContent='Bring the local services online';$('next-description').textContent='Start the blockchain, compile and deploy the contracts, then start the facilitator and server.';}
  explanations.forEach((entry,index)=>{const observed=run?.events?.some(event=>event.type===entry[3]);$('arrow-'+index).setAttribute('class',`arrow-group ${observed?'observed':''} ${detail?.[3]===index?'current':''}`);});
  const terms=run?.events?.find(event=>event.type==='terms-validated')?.data;
  if(terms)rows($('terms'),[['Network',terms.network],['Price',`${amount(terms.amount)} TestUSD (${terms.amount} base units)`],['Asset',terms.asset],['Pay to',terms.payTo],['Scheme',terms.scheme]]);else blank($('terms'),'Read the AgentCard and send an unpaid request to inspect its validated terms.');
  renderTransientPayload();
  const evidence=run?.evidence;
  if(evidence?.receipt){const r=evidence.receipt;rows($('receipt'),[['Status',r.status],['Tx hash',r.transactionHash],['Block',r.blockNumber],['Gas used',r.gasUsed],['App state',evidence.applicationStatus]]);const details=element('details');details.append(element('summary','Token / authorization events'),element('pre',pretty(evidence.events)));$('receipt').append(details);}
  else if(run?.transaction||evidence?.transaction)rows($('receipt'),[['Tx hash',run.transaction||evidence.transaction],['Status','Confirmation not independently established yet']]);
  else blank($('receipt'),evidence?.status||'No transaction observed. A signature and a verification are not a confirmed payment.');
  if(run?.result){$('result').className='';$('result').replaceChildren(element('pre',pretty(run.result.result)));const details=element('details');details.append(element('summary','Full response, receipt & balances'),element('pre',pretty(run.result)));$('result').append(details);}else blank($('result'),'Computation starts after payment confirmation.');
  renderCountdown();renderControls();
}
function renderCountdown(){const point=run?.checkpoint;const authorization=transientPayload?.payload?.authorization;if(authorization?.validBefore&&Date.now()>=Number(authorization.validBefore)*1000)clearTransientPayload();$('countdown').textContent=point?`Checkpoint expires in ${Math.max(0,Math.ceil((point.expiresAt-Date.now())/1000))}s.${transientPayload?' · Payment signature expires in '+Math.max(0,Math.ceil(Number(authorization.validBefore)-Date.now()/1000))+'s.':''}`:'';renderControls();}
function clearTransientPayload(){transientPayload=undefined;transientRunId='';blank($('authorization'),'The client creates its payment authorization after you approve the terms.');}
function renderTransientPayload(){
  const payload=transientRunId===selected?transientPayload:undefined;
  if(!payload){
    const wasSigned=run?.events?.some(event=>event.type==='signed');
    blank($('authorization'),wasSigned?'The client signed this request, but its live payload view was cleared on refresh or disconnect. The signature was not saved and cannot be recovered. Cancel or inspect the recorded payment outcome before another request.':'The client creates its payment authorization after you approve the terms.');
    return;
  }
  const authorization=payload.payload?.authorization;
  if(authorization?.validBefore&&Date.now()>=Number(authorization.validBefore)*1000){clearTransientPayload();notice('The displayed payment authorization expired and was cleared. No new signature was created.');return;}
  $('authorization').className='';
  $('authorization').replaceChildren(element('p',`x402 v${payload.x402Version} · ${payload.accepted.scheme} · ${payload.accepted.network}`,'payload-label'));
  const fields=[['Payer',authorization?.from],['Recipient',authorization?.to],['Amount',`${amount(authorization?.value)} TestUSD`],['Valid after',new Date(Number(authorization?.validAfter)*1000).toLocaleString()],['Valid until',new Date(Number(authorization?.validBefore)*1000).toLocaleString()],['Nonce',authorization?.nonce],['Signature',payload.payload?.signature]];
  rows($('authorization'),fields);
  const warning=element('p','This 65-byte signature can authorize the displayed transfer until expiry. Anyone who can read this local dashboard can copy it. The dashboard clears it when retry starts. Private signer keys are never included.','security-note');
  const details=element('details');details.append(element('summary','Full signed x402 payload'),element('pre',pretty(payload)));$('authorization').append(details,warning);
}
function renderState(){
  renderServices();renderSetup();
  const balance=state.deployment?.balances;
  $('client-balance').textContent=balance?`${amount(balance.client)} TestUSD`:'—';$('card-balance').textContent=balance?`${amount(balance.card)} TestUSD`:'—';
  $('balance-time').textContent=balance?`RPC · block ${state.deployment.block} · ${new Date(state.deployment.checkedAt).toLocaleTimeString()}`:'Waiting for a valid deployment.';
  $('gas-balances').textContent=balance?`Facilitator: ${amount(balance.facilitatorEth,18)} ETH\nClient: ${amount(balance.clientEth,18)} ETH`:'—';
  $('deployment-state').textContent=state.deployment?.valid?'CHAIN + ANCHOR VALID':'NOT VALIDATED';$('deployment-error').textContent=state.deployment?.valid?'':state.deployment?.error||'';
  const manifest=state.deployment?.manifest;const key=JSON.stringify(manifest);if(configKey!==key){configKey=key;$('raw-config').textContent=manifest?pretty(manifest):'Not deployed';const fragment=document.createDocumentFragment();fields.forEach(([field,meaning])=>{const value=field.split('.').reduce((obj,key)=>obj?.[key],manifest);const tr=element('tr');tr.append(element('td',field),element('td',value===undefined?'—':String(value)),element('td',meaning));fragment.append(tr);});$('config-fields').replaceChildren(fragment);}
  const history=state.runs||[];const historyKey=JSON.stringify(history.map(r=>[r.id,r.status]));if(historyKey!==runKey){runKey=historyKey;const options=history.length?history.slice().reverse().map(r=>{const option=element('option',`${r.id.slice(0,8)} · ${r.status}`);option.value=r.id;return option;}):[element('option','No runs yet')];$('run-select').replaceChildren(...options);if(!selected&&history.length)selected=history.at(-1).id;$('run-select').value=selected;}
  renderControls();
}
function renderLogs(){
  const source=$('log-source').value;const search=$('log-search').value.toLowerCase();const fragment=document.createDocumentFragment();
  for(const event of logEvents){if(source!=='all'&&source!==event.source)continue;const message=event.type==='log'?event.data.message:`${event.type} ${JSON.stringify(event.data??{})}`;if(search&&!message.toLowerCase().includes(search))continue;const row=element('div',undefined,`log-line ${event.type==='failure'||event.data?.stream==='stderr'?'error':''}`);row.append(element('span',new Date(event.timestamp).toLocaleTimeString('en-GB'),'log-time'),element('span',event.source,'log-source'),element('span',message,'log-message'));fragment.append(row);}
  const output=$('log-output');const oldTop=output.scrollTop;output.replaceChildren(fragment);output.scrollTop=autoScroll?output.scrollHeight:oldTop;$('log-count').textContent=logEvents.length;
}
async function poll(){const data=await api('/api/status');token=data.sessionToken;state=data;renderState();}
let loadingRun=false;
async function loadRun(){if(!selected||loadingRun)return;loadingRun=true;const id=selected;try{const data=await api(`/api/runs/${id}`);if(selected===id){run=data;renderRun();}}catch(error){notice(error.message);}finally{loadingRun=false;}}
function download(name,data){const blob=new Blob([pretty(data)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('start-run').addEventListener('click',()=>perform(async()=>{let numbers;try{numbers=JSON.parse($('numbers').value);}catch{throw new Error('Enter a valid JSON array, such as [2, 4, 6].');}const created=await api('/api/runs',{numbers});selected=created.id;run=created;renderRun();}));
$('continue').addEventListener('click',()=>perform(()=>api(`/api/runs/${selected}/continue`,{checkpointId:run.checkpoint.checkpointId})));
$('cancel').addEventListener('click',()=>perform(()=>api(`/api/runs/${selected}/cancel`,{})));
$('close-outcome').addEventListener('click',()=>perform(()=>api(`/api/runs/${selected}/close`,{})));
$('run-select').addEventListener('change',()=>{clearTransientPayload();selected=$('run-select').value;run=undefined;void loadRun();});
$('refresh-evidence').addEventListener('click',()=>perform(async()=>{await poll();await loadRun();}));
$('download-evidence').addEventListener('click',()=>download(`a2a-run-${selected}.json`,{sessionId:state.sessionId,exportedAt:new Date().toISOString(),deploymentAnchor:run.deploymentAnchor,...run}));
$('download-logs').addEventListener('click',()=>download('a2a-sanitized-logs.json',logEvents));
$('log-source').addEventListener('change',renderLogs);$('log-search').addEventListener('input',renderLogs);
$('autoscroll').addEventListener('click',()=>{autoScroll=!autoScroll;$('autoscroll').textContent=`Autoscroll ${autoScroll?'on':'off'}`;$('autoscroll').setAttribute('aria-pressed',String(autoScroll));renderLogs();});
$('close-dialog').addEventListener('click',()=>$('explanation').close());
$('diagram-help').addEventListener('click',()=>{$('explanation-title').textContent='Four actors, one paid request';$('explanation-copy').textContent='Read from top to bottom, following the supplied project sequence diagram. Solid arrows are requests; dashed arrows are responses. Green arrows have an observed execution event; the highlighted row is the next manual action. Click any arrow for its meaning and real data. A local blockchain holds the card and token ledger. The separate facilitator verifies and settles payment before the server computes.';$('explanation-data').textContent='Setup and each manual checkpoint run the actual programs. Hardhat may confirm a submitted transfer immediately.';$('explanation').showModal();});
drawDiagram();
const stream=new EventSource('/api/events');
stream.onopen=()=>{$('connection').textContent='● Live connection';};
stream.onerror=()=>{$('connection').textContent='Reconnecting…';};
stream.addEventListener('session',event=>{const data=JSON.parse(event.data);if(lastSession&&lastSession!==data.sessionId){clearTransientPayload();logEvents=[];lastLogId=0;selected='';run=undefined;notice('Dashboard session restarted. The temporary payment payload and in-memory run history were cleared.');}lastSession=data.sessionId;if(data.historyTruncated)$('log-note').textContent='Earlier session events were evicted. Showing the retained event window; historical fixture evidence is not substituted.';});
let logScheduled=false;
stream.addEventListener('volatile-payment-payload',event=>{const item=JSON.parse(event.data);clearTransientPayload();transientRunId=item.runId;transientPayload=item.data;renderTransientPayload();});
stream.onmessage=event=>{const item=JSON.parse(event.data);if(item.id<=lastLogId)return;lastLogId=item.id;logEvents.push(item);if(logEvents.length>1500)logEvents.shift();if(['paid-retry','failure','result'].includes(item.type)&&item.runId===transientRunId)clearTransientPayload();if(logScheduled===false){logScheduled=true;setTimeout(()=>{renderLogs();logScheduled=false;},100);}if(item.runId===selected&&item.type!=='log')void loadRun();};
window.addEventListener('pagehide',clearTransientPayload);
void poll().then(loadRun).catch(error=>notice(error.message));
setInterval(()=>void poll().catch(()=>{$('connection').textContent='Backend unavailable';}),1200);
setInterval(()=>void loadRun(),2200);setInterval(renderCountdown,1000);
