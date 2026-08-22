import { MetaBusinessOAuthService } from './meta-business-oauth.service';

describe('MetaBusinessOAuthService',()=>{
  const originalGraphVersion=process.env.META_GRAPH_API_VERSION;
  afterEach(()=>{
    if(originalGraphVersion===undefined)delete process.env.META_GRAPH_API_VERSION;else process.env.META_GRAPH_API_VERSION=originalGraphVersion;
    jest.restoreAllMocks();
  });

  function service(){
    const prisma={$executeRaw:jest.fn(async()=>1)};
    const developer={value:jest.fn(async (_org:string,_provider:string,field:string)=>field==='appId'?'1375702414130345':'business-config-id')};
    return{subject:new MetaBusinessOAuthService(prisma as never,developer as never),prisma,developer};
  }

  it('starts Facebook Login for Business with config_id and no scope query',async()=>{
    const {subject,developer}=service();
    const result=await subject.start({organizationId:'00000000-0000-0000-0000-000000000001',sessionId:'00000000-0000-0000-0000-000000000002'} as never,'FACEBOOK');
    const url=new URL(result.authorizationUrl);
    expect(url.pathname).toContain('/v26.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('1375702414130345');
    expect(url.searchParams.get('config_id')).toBe('business-config-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('override_default_response_type')).toBe('true');
    expect(url.searchParams.has('scope')).toBe(false);
    expect(result.callbackUrl).toContain('/api/stations/social/oauth/facebook/callback');
    expect(developer.value).toHaveBeenCalledWith(expect.any(String),'META','configId','META_BUSINESS_LOGIN_CONFIG_ID');
  });
});
