import { MetaBusinessCallbackService } from './meta-business-callback.service';

describe('MetaBusinessCallbackService',()=>{
  const originalFetch=global.fetch;

  afterEach(()=>{
    global.fetch=originalFetch;
    jest.restoreAllMocks();
  });

  function setup(){
    const prisma={$executeRaw:jest.fn(async()=>1),$queryRaw:jest.fn()};
    const cipher={encrypt:jest.fn((value:string|null|undefined)=>value?`encrypted:${value}`:null)};
    const developer={value:jest.fn(async (_org:string,_provider:string,field:string)=>field==='appId'?'1375702414130345':'meta-app-secret')};
    const subject=new MetaBusinessCallbackService(prisma as never,cipher as never,developer as never);
    return{subject,prisma,cipher,developer};
  }

  function response(data:unknown,status=200){
    return{ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)} as Response;
  }

  it('surfaces the safe Meta error code and message',async()=>{
    const {subject}=setup();
    global.fetch=jest.fn(async()=>response({error:{message:'Invalid OAuth access token.',code:190,error_subcode:463}},400)) as unknown as typeof fetch;

    await expect((subject as never as {fetchMeta:(url:string,stage:string)=>Promise<unknown>}).fetchMeta('https://graph.facebook.com/test','échange du code OAuth'))
      .rejects.toThrow('Meta — échange du code OAuth refusé (400 code 190/463) : Invalid OAuth access token.');
  });

  it('exchanges a Facebook Business Login code and stores the selected Page token encrypted',async()=>{
    const {subject,prisma,cipher}=setup();
    const fetchMock=jest.fn()
      .mockResolvedValueOnce(response({access_token:'short-user-token',expires_in:3600}))
      .mockResolvedValueOnce(response({access_token:'long-user-token',expires_in:5184000}))
      .mockResolvedValueOnce(response({data:[{id:'page-khe',name:'KHE Booth',access_token:'page-token'}]}))
      .mockResolvedValueOnce(response({data:[
        {permission:'business_management',status:'granted'},
        {permission:'pages_show_list',status:'granted'},
        {permission:'pages_read_engagement',status:'granted'},
        {permission:'pages_manage_posts',status:'granted'},
      ]}));
    global.fetch=fetchMock as unknown as typeof fetch;

    const result=await (subject as never as {finish:(org:string,provider:'FACEBOOK',code:string)=>Promise<unknown>}).finish('00000000-0000-0000-0000-000000000001','FACEBOOK','oauth-code');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/v26.0/oauth/access_token?');
    expect(String(fetchMock.mock.calls[0][0])).toContain('code=oauth-code');
    expect(String(fetchMock.mock.calls[1][0])).toContain('grant_type=fb_exchange_token');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/v26.0/me/accounts');
    expect(cipher.encrypt).toHaveBeenCalledWith('page-token');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({provider:'FACEBOOK',status:'CONNECTED',externalAccountId:'page-khe',externalAccountName:'KHE Booth'});
  });
});
