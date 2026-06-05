import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

/** Single icon set for the whole app — clean Feather line icons, no emojis. */
export default function Icon({ name, size = 20, color = colors.text, style }) {
  return <Feather name={name} size={size} color={color} style={style} />;
}
