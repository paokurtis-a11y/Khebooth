import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface SecurePasswordFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
}

export function SecurePasswordField({value,onChangeText,placeholder='Mot de passe',onSubmitEditing}:SecurePasswordFieldProps){
  const[visible,setVisible]=useState(false);
  const stars=useMemo(()=>'★'.repeat(Math.min(value.length,28)),[value]);
  return <View style={styles.wrapper}>
    <View style={styles.inputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#777777"
        style={styles.input}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={visible?'Masquer le mot de passe':'Afficher le mot de passe'} style={styles.eye} onPress={()=>setVisible((current)=>!current)}>
        <Text style={styles.eyeText}>{visible?'🙈':'👁'}</Text>
      </Pressable>
    </View>
    <Text style={styles.feedback}>{value.length===0?'Saisie sécurisée':visible?'Mot de passe visible':stars}</Text>
  </View>;
}

const styles=StyleSheet.create({
  wrapper:{gap:5},inputRow:{position:'relative',justifyContent:'center'},input:{borderWidth:1,borderColor:'#d0d0d0',borderRadius:12,paddingLeft:14,paddingRight:54,paddingVertical:12,color:'#111',backgroundColor:'#fff'},eye:{position:'absolute',right:7,width:42,height:38,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#f1f1f1'},eyeText:{fontSize:17},feedback:{minHeight:18,fontSize:11,letterSpacing:1.7,opacity:.58,color:'#333'},
});
