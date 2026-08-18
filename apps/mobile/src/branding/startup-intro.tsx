import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

interface StartupIntroProps { onDone: () => void; }

const KHE_GOLD='#d7b24c';
const KHE_SKY='#8ad9f5';
const KHE_LOGO=require('./khe-logo.jpeg');

export function StartupIntro({onDone}:StartupIntroProps){
  const k=useRef(new Animated.Value(0)).current;
  const h=useRef(new Animated.Value(0)).current;
  const e=useRef(new Animated.Value(0)).current;
  const title=useRef(new Animated.Value(0)).current;
  const booth360=useRef(new Animated.Value(0)).current;
  const kiosk=useRef(new Animated.Value(0)).current;
  const logo=useRef(new Animated.Value(0)).current;
  const copy=useRef(new Animated.Value(0)).current;
  const exit=useRef(new Animated.Value(1)).current;
  const [skipVisible,setSkipVisible]=useState(false);
  const finished=useRef(false);

  const letters=useMemo(()=>[
    {letter:'K',value:k},
    {letter:'H',value:h},
    {letter:'E',value:e},
  ],[e,h,k]);

  function finish(){
    if(finished.current)return;
    finished.current=true;
    Animated.timing(exit,{toValue:0,duration:360,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}).start(onDone);
  }

  useEffect(()=>{
    const skipTimer=setTimeout(()=>setSkipVisible(true),1050);
    const sequence=Animated.sequence([
      Animated.timing(k,{toValue:1,duration:280,easing:Easing.out(Easing.back(1.35)),useNativeDriver:true}),
      Animated.timing(h,{toValue:1,duration:280,easing:Easing.out(Easing.back(1.35)),useNativeDriver:true}),
      Animated.timing(e,{toValue:1,duration:280,easing:Easing.out(Easing.back(1.35)),useNativeDriver:true}),
      Animated.parallel([
        Animated.timing(title,{toValue:1,duration:390,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
        Animated.timing(logo,{toValue:1,duration:520,easing:Easing.out(Easing.back(1.12)),useNativeDriver:true}),
      ]),
      Animated.parallel([
        Animated.timing(booth360,{toValue:1,duration:500,easing:Easing.out(Easing.back(1.15)),useNativeDriver:true}),
        Animated.timing(kiosk,{toValue:1,duration:500,easing:Easing.out(Easing.back(1.15)),useNativeDriver:true}),
      ]),
      Animated.timing(copy,{toValue:1,duration:410,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.delay(800),
    ]);
    sequence.start(({finished:completed})=>{if(completed)finish();});
    return()=>{clearTimeout(skipTimer);sequence.stop();};
  },[]);

  return <Animated.View style={[styles.page,{opacity:exit}]}>
    <View style={styles.skyGlow}/><View style={styles.goldGlow}/>
    <View style={styles.stage}>
      <View style={styles.letterRow}>
        {letters.map(({letter,value})=><Animated.Text key={letter} style={[styles.letter,{opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[28,0]})},{scale:value.interpolate({inputRange:[0,1],outputRange:[0.72,1]})}]}]}>{letter}</Animated.Text>)}
      </View>
      <Animated.Text style={[styles.boothTitle,{opacity:title,transform:[{translateY:title.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}]}>KHE BOOTH</Animated.Text>
      <Animated.View style={[styles.logoFrame,{opacity:logo,transform:[{scale:logo.interpolate({inputRange:[0,1],outputRange:[0.72,1]})},{rotate:logo.interpolate({inputRange:[0,1],outputRange:['-4deg','0deg']})}]}]}>
        <Animated.Image source={KHE_LOGO} resizeMode="contain" style={styles.logoImage}/>
      </Animated.View>

      <View style={styles.boothRow}>
        <Animated.View style={[styles.booth360,{opacity:booth360,transform:[{translateX:booth360.interpolate({inputRange:[0,1],outputRange:[-70,0]})},{scale:booth360.interpolate({inputRange:[0,1],outputRange:[0.76,1]})}]}]}>
          <View style={styles.ring}><View style={styles.phone}><Text style={styles.phoneText}>360°</Text></View></View><Text style={styles.boothLabel}>PHOTOBOOTH 360</Text>
        </Animated.View>
        <Animated.View style={[styles.kiosk,{opacity:kiosk,transform:[{translateX:kiosk.interpolate({inputRange:[0,1],outputRange:[70,0]})},{scale:kiosk.interpolate({inputRange:[0,1],outputRange:[0.76,1]})}]}]}>
          <View style={styles.kioskHead}><View style={styles.lens}/></View><View style={styles.kioskBody}><Text style={styles.kioskScreen}>KHE</Text></View><View style={styles.kioskStand}/><Text style={styles.boothLabel}>BORNE PHOTOBOOTH</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.copy,{opacity:copy,transform:[{translateY:copy.interpolate({inputRange:[0,1],outputRange:[16,0]})}]}]}>
        <Text style={styles.slogan}>Votre événement, notre expertise</Text>
        <Text style={styles.description}>Capturez, créez et partagez vos souvenirs avec une régie photobooth pensée pour vos événements.</Text>
      </Animated.View>
    </View>
    {skipVisible?<Pressable accessibilityRole="button" style={styles.skip} onPress={finish}><Text style={styles.skipText}>PASSER</Text></Pressable>:null}
  </Animated.View>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#101114',alignItems:'center',justifyContent:'center',overflow:'hidden'},stage:{width:'100%',maxWidth:780,paddingHorizontal:26,alignItems:'center',gap:9,zIndex:2},
  skyGlow:{position:'absolute',width:430,height:430,borderRadius:215,backgroundColor:'rgba(138,217,245,.18)',top:-120,right:-110},goldGlow:{position:'absolute',width:380,height:380,borderRadius:190,backgroundColor:'rgba(215,178,76,.15)',bottom:-130,left:-120},
  letterRow:{flexDirection:'row',gap:4,alignItems:'flex-end'},letter:{color:KHE_GOLD,fontSize:68,lineHeight:76,fontWeight:'900',letterSpacing:-5,textShadowColor:'rgba(255,236,167,.5)',textShadowRadius:14},boothTitle:{color:'#fff',fontSize:22,fontWeight:'900',letterSpacing:7},
  logoFrame:{width:150,height:92,borderRadius:18,borderWidth:1,borderColor:'rgba(215,178,76,.55)',overflow:'hidden',backgroundColor:'#151619',shadowColor:KHE_GOLD,shadowOpacity:.28,shadowRadius:12,elevation:7},logoImage:{width:'100%',height:'100%'},
  boothRow:{flexDirection:'row',gap:28,alignItems:'flex-end',justifyContent:'center',marginTop:7,flexWrap:'wrap'},booth360:{width:150,alignItems:'center',gap:6},ring:{width:118,height:68,borderRadius:59,borderWidth:5,borderColor:KHE_GOLD,alignItems:'center',justifyContent:'center',transform:[{rotateX:'58deg'}]},phone:{width:34,height:62,borderRadius:9,backgroundColor:'#15161a',borderWidth:2,borderColor:KHE_SKY,alignItems:'center',justifyContent:'center',transform:[{rotateX:'-58deg'}]},phoneText:{color:'#fff',fontSize:9,fontWeight:'900'},
  kiosk:{width:140,alignItems:'center'},kioskHead:{width:82,height:32,borderTopLeftRadius:23,borderTopRightRadius:23,backgroundColor:KHE_GOLD,alignItems:'center',justifyContent:'center'},lens:{width:12,height:12,borderRadius:6,backgroundColor:'#141519',borderWidth:2,borderColor:KHE_SKY},kioskBody:{width:90,height:72,borderRadius:14,backgroundColor:'#25272c',borderWidth:3,borderColor:KHE_GOLD,alignItems:'center',justifyContent:'center'},kioskScreen:{color:KHE_SKY,fontWeight:'900',letterSpacing:2},kioskStand:{width:21,height:31,backgroundColor:KHE_GOLD,borderBottomLeftRadius:5,borderBottomRightRadius:5},boothLabel:{color:'#d6d8dd',fontSize:8,fontWeight:'900',letterSpacing:1.1,textAlign:'center',marginTop:4},
  copy:{alignItems:'center',gap:6,marginTop:8,maxWidth:590},slogan:{color:KHE_GOLD,fontSize:17,fontWeight:'900',textAlign:'center'},description:{color:'#d8dce3',fontSize:11,lineHeight:17,textAlign:'center',maxWidth:520},
  skip:{position:'absolute',right:22,bottom:24,borderWidth:1,borderColor:'rgba(255,255,255,.35)',borderRadius:18,paddingHorizontal:15,paddingVertical:9,zIndex:4},skipText:{color:'#fff',fontSize:9,fontWeight:'900',letterSpacing:1.2},
});
