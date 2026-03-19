import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Linking, Pressable, type PressableProps } from 'react-native';

interface ExternalLinkProps extends PressableProps {
  href: string;
}

export function ExternalLink({ href, children, ...rest }: ExternalLinkProps) {
  return (
    <Pressable
      {...rest}
      onPress={async () => {
        try {
          const canOpen = await Linking.canOpenURL(href);
          if (canOpen) {
            await openBrowserAsync(href, {
              presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
            });
          }
        } catch (error) {
          console.error('Error opening link:', error);
        }
      }}
    >
      {children}
    </Pressable>
  );
}
