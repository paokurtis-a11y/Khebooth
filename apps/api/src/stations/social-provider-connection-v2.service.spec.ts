import { SocialProviderConnectionV2Service } from './social-provider-connection-v2.service';

describe('SocialProviderConnectionV2Service Meta OAuth',()=>{
  const originalFetch=global.fetch;

  afterEach(()=>{
    global.fetch=originalFetch;
    jest.restoreAllMocks();
  });

  function service(){
    const developer={
      value:jest.fn(async (_org:string,_provider:string,field:string)=>field==='appId'?'meta-app-id':'meta-app-secret'),
    };
    return new SocialProviderConnectionV2Service({} as never,{} as never,developer as never);
  }

  it('exchanges the short-lived Meta user token before loading Pages',async()=>{
    const subject=service();
    const fetchMock=jest.fn()
      .mockResolvedValueOnce({ok:true,json:async()=>({access_token:'short-token',expires_in:3600})})
      .mockResolvedValueOnce({ok:true,json:async()=>({access_token:'long-token',expires_in:5184000})});
    global.fetch=fetchMock as unknown as typeof fetch;
    const pages=jest.spyOn(subject as never as {metaPages:(token:string)=>Promise<unknown>},'metaPages').mockResolvedValue({pages:[{id:'page-1',name:'KHE Booth',access_token:'page-token'}],scopes:['pages_show_list','pages_manage_posts']});
    const select=jest.spyOn(subject as never as {selectMetaPage:(...args:unknown[])=>Promise<unknown>},'selectMetaPage').mockResolvedValue({provider:'FACEBOOK',status:'CONNECTED'});

    await (subject as never as {finishMeta:(org:string,provider:'FACEBOOK',code:string)=>Promise<unknown>}).finishMeta('org-1','FACEBOOK','oauth-code');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('grant_type=fb_exchange_token');
    expect(String(fetchMock.mock.calls[1][0])).toContain('fb_exchange_token=short-token');
    expect(pages).toHaveBeenCalledWith('long-token');
    expect(select).toHaveBeenCalledWith('org-1','FACEBOOK','page-1','long-token',['pages_show_list','pages_manage_posts']);
  });

  it('stores the Page access token without inheriting the user-token expiry',async()=>{
    const subject=service();
    jest.spyOn(subject as never as {connection:(org:string,provider:string)=>Promise<unknown>},'connection').mockResolvedValue(null);
    jest.spyOn(subject as never as {metaPages:(token:string)=>Promise<unknown>},'metaPages').mockResolvedValue({pages:[{id:'page-1',name:'KHE Booth',access_token:'page-token'}],scopes:['pages_show_list','pages_manage_posts']});
    const save=jest.spyOn(subject as never as {saveConnection:(value:Record<string,unknown>)=>Promise<void>},'saveConnection').mockResolvedValue();

    await (subject as never as {selectMetaPage:(org:string,provider:'FACEBOOK',pageId:string,userToken:string,scopes:string[])=>Promise<unknown>}).selectMetaPage('org-1','FACEBOOK','page-1','long-token',['pages_show_list','pages_manage_posts']);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      provider:'FACEBOOK',
      accessToken:'page-token',
      tokenExpiresAt:null,
      status:'CONNECTED',
    }));
  });
});
