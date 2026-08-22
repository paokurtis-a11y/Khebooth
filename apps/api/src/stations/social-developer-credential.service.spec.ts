import { SOCIAL_DEVELOPER_DEFINITIONS } from './social-developer-credential.service';

describe('SocialDeveloperCredential definitions',()=>{
  it('keeps Meta shared by Facebook and Instagram, including the Business Login configuration id, and requires no passwords',()=>{
    expect(SOCIAL_DEVELOPER_DEFINITIONS.META.fields).toEqual(['appId','appSecret','configId']);
    expect(Object.values(SOCIAL_DEVELOPER_DEFINITIONS).flatMap(item=>item.fields)).not.toContain('password');
  });
  it('covers every server/developer credential required by KHE social connections',()=>{
    expect(Object.keys(SOCIAL_DEVELOPER_DEFINITIONS).sort()).toEqual(['META','TELEGRAM','TIKTOK','WHATSAPP','X','YOUTUBE']);
    expect(SOCIAL_DEVELOPER_DEFINITIONS.WHATSAPP.fields).toEqual(['accessToken','phoneNumberId']);
    expect(SOCIAL_DEVELOPER_DEFINITIONS.TELEGRAM.fields).toEqual(['botToken','targetChatId']);
  });
});
