import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

// 本地化资源类型
type LocaleResources = typeof zhCN;

// 支持的语言类型
type Language = 'zh-CN' | 'en-US';

// 本地化上下文类型
interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof LocaleResources) => string;
}

// 创建本地化上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 本地化资源映射
const resources: Record<Language, LocaleResources> = {
  'zh-CN': zhCN,
  'en-US': enUS
};

// 本地化提供者组件
interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  // 从localStorage获取语言设置，如果没有则使用默认语言
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    return savedLanguage || 'zh-CN';
  });

  // 当语言变化时，保存到localStorage
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // 翻译函数
  const t = (key: keyof LocaleResources): string => {
    return resources[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

// 自定义钩子，用于使用本地化功能
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
