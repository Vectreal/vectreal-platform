import { DefaultSpinner } from '@vctrl/shared/components';

const LoadingOverlay = () => {
  return (
    <div className="absolute top-0 left-0 w-full h-full bg-zinc-950/25 flex items-center justify-center">
      <DefaultSpinner />
    </div>
  );
};

export default LoadingOverlay;
