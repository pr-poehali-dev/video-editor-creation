import { DemoProvider } from '@/contexts/demo-context';
import Index from './Index';

const Demo = () => (
  <DemoProvider isDemo={true}>
    <Index />
  </DemoProvider>
);

export default Demo;
