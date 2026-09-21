/** Per-tab UI presence only. The server checks the ID against this conversation's records. */
let visible:{conversationId:string;sessionId:string}|null=null;
export function setVisibleWorkspace(value:typeof visible){visible=value;}
export function visibleWorkspaceId(conversationId:string){return visible?.conversationId===conversationId?visible.sessionId:null;}
