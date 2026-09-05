export const authClerkAppearance = {
  variables: {
    colorPrimary: '#7042f4',
    colorBackground: '#ffffff',
    colorText: '#09090b',
    colorTextSecondary: '#71717a',
    colorInputBackground: '#ffffff',
    colorInputText: '#09090b',
    colorNeutral: '#09090b',
    borderRadius: '1rem',
    fontFamily: 'inherit',
  },
  elements: {
    rootBox: 'w-full flex justify-center [color-scheme:light]',
    cardBox: '!w-full !max-w-[580px] !shadow-none !border-none !bg-transparent',
    card: '!w-full !max-w-[580px] !shadow-none !border-none !bg-transparent !p-0',
    header: '!text-center !p-0 !mb-4',
    headerTitle: '!text-[26px] !font-bold !text-[#09090b] !tracking-tight',
    headerSubtitle: '!text-[14px] !font-normal !text-[#71717a] !mt-1',
    socialButtonsBlockButton:
      '!w-full !h-[44px] !bg-white hover:!bg-[#f9fafb] active:!bg-[#f3f4f6] !border !border-[#e5e7eb] !rounded-full !text-[#374151] !font-medium !text-[15px] !shadow-none flex items-center justify-center gap-3 transition-colors cursor-pointer',
    socialButtonsBlockButtonText: '!text-[#374151] !font-medium !text-[15px]',
    socialButtonsProviderIcon: '!w-5 !h-5',
    dividerRow: '!my-4 !flex !items-center !justify-center',
    dividerLine: '!bg-[#e5e7eb] !h-[1px]',
    dividerText: '!text-[#9ca3af] !text-xs !font-normal !px-3 !bg-white',
    formField: '!mb-3',
    formFieldLabel: '!text-[14px] !font-medium !text-[#09090b] !mb-1.5 !block !text-left',
    formFieldInput:
      '!w-full !h-[44px] !rounded-[16px] !border !border-[#e5e7eb] focus:!border-[#7042f4] focus:!ring-2 focus:!ring-[#7042f4]/20 !bg-white !text-[#09090b] !text-[15px] !px-4 placeholder:!text-[#9ca3af] !outline-none transition-all',
    formButtonPrimary:
      '!w-full !h-[44px] !rounded-full !bg-[#7042f4] hover:!bg-[#6330cf] active:!scale-[0.99] !text-white !font-medium !text-[15px] !shadow-none transition-all cursor-pointer !mt-2 flex items-center justify-center gap-2',
    footer: '!bg-transparent !border-none !p-0 !mt-4',
    footerAction: '!bg-transparent !border-none !text-center',
    footerActionText: '!text-[#71717a] !text-[14px]',
    footerActionLink: '!text-[#7042f4] hover:!text-[#6330cf] !font-semibold !text-[14px]',
    footerPagesLink: '!text-[#71717a] !text-xs hover:!text-[#09090b]',
  },
}



