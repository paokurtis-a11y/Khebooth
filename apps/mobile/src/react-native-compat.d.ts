import 'react-native';

declare module 'react-native' {
  interface StyleSheetStatic {
    /** Compatibility alias retained by React Native runtime for full-screen absolute overlays. */
    absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  }

  interface ImageProps {
    /** Supported by the native view even when omitted from this React Native type version. */
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  }
}
