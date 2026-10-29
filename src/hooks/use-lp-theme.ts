import { useEffect } from 'react';

const useLpTheme = () => {
  useEffect(() => {
    document.body.classList.add('lp-app');
    return () => document.body.classList.remove('lp-app');
  }, []);
};

export default useLpTheme;
