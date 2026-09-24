import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

const accent = '#5B6EF5';
const fontFamily = "'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const lightTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: accent,
    colorLink: accent,
    borderRadius: 8,
    fontFamily,
    colorBgLayout: '#F6F7FB',
    colorBgContainer: '#FFFFFF',
    colorText: '#242A38',
    colorTextHeading: '#1B2030',
    colorTextSecondary: '#5F6B82',
    colorTextDescription: '#5F6B82',
    colorBorder: '#DDE1EC',
    colorBorderSecondary: '#E7E9F3',
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: accent,
    colorLink: accent,
    borderRadius: 8,
    fontFamily,
    colorBgLayout: '#181B24',
    colorBgContainer: '#20242F',
    colorText: '#E7E9F3',
    colorTextHeading: '#F5F6FA',
    colorTextSecondary: '#A3ACC2',
    colorTextDescription: '#A3ACC2',
    colorBorder: '#33394A',
    colorBorderSecondary: '#2A2F3D',
  },
  components: {
    // Match the cards instead of antd's default elevated grey.
    Modal: {
      contentBg: '#20242F',
      headerBg: '#20242F',
      footerBg: '#20242F',
    },
  },
};
