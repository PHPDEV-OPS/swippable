/**
 * Clerk styling for the auth pages.
 *
 * Presentation only - this never changes which fields Clerk renders or how it
 * behaves. It matches the reference design: a large display heading, filled
 * grey inputs rather than outlined white ones, dashed rules, and full-width
 * pill controls on the brand purple.
 */

export const authClerkAppearance = {
    layout: {
        /*
          With three providers enabled (Google, Base, Coinbase Wallet) Clerk
          falls back to bare icon buttons, which left three unlabelled circles
          where the sign-in options should be - a blue square is not a thing
          anyone can be expected to recognise. This pins the labelled variant.
        */
        socialButtonsVariant: 'blockButton' as const,
        shimmer: false,
    },
    variables: {
        colorPrimary: '#7042f4',
        colorBackground: '#ffffff',
        colorText: '#09090b',
        colorTextSecondary: '#71717a',
        colorInputBackground: '#f4f4f6',
        colorInputText: '#09090b',
        colorNeutral: '#09090b',
        borderRadius: '1rem',
        fontFamily: 'inherit',
    },
    elements: {
        rootBox: 'w-full flex justify-center [color-scheme:light]',
        cardBox: '!w-full !max-w-[420px] !shadow-none !border-none !bg-transparent',
        card: '!w-full !max-w-[420px] !shadow-none !border-none !bg-transparent !p-0',

        // Display heading, sized to the design rather than Clerk's default.
        // It steps down on a phone so the title never wraps to three lines
        // above a form the person still has to scroll to.
        header: '!text-center !p-0 !mb-5',
        headerTitle:
            '!text-[30px] sm:!text-[36px] !leading-[1.1] !font-bold !text-[#09090b] !tracking-[-0.02em]',
        headerSubtitle: '!text-[14.5px] sm:!text-[15px] !font-normal !text-[#52525b] !mt-2',

        // A dashed rule separates the heading from the form in the design.
        main: '!gap-0 !border-t !border-dashed !border-[#d9d9e0] !pt-6',

        // Three options stack here, so they carry their own even rhythm rather
        // than inheriting Clerk's default spacing.
        socialButtons: '!w-full !gap-2.5',
        socialButtonsBlockButton:
            '!w-full !h-[48px] sm:!h-[52px] !bg-[#f4f4f6] hover:!bg-[#ebebef] active:!bg-[#e4e4ea] !border-none !rounded-full !text-[#18181b] !font-semibold !text-[15px] !shadow-none !justify-center !gap-3 transition-colors cursor-pointer',
        socialButtonsBlockButtonText: '!text-[#18181b] !font-semibold !text-[14.5px] sm:!text-[15px]',
        socialButtonsProviderIcon: '!w-[19px] !h-[19px]',

        dividerRow: '!my-5 !flex !items-center !justify-center',
        dividerLine: '!bg-transparent !h-0 !border-t !border-dashed !border-[#d9d9e0]',
        dividerText: '!text-[#9ca3af] !text-[13px] !font-normal !px-3.5 !bg-transparent',

        form: '!gap-0',
        formField: '!mb-4',
        formFieldLabel: '!text-[13.5px] !font-semibold !text-[#18181b] !mb-2 !block !text-left',
        formFieldAction: '!text-[13px] !font-semibold !text-[#7042f4] hover:!text-[#6330cf]',
        // Filled, borderless input - the outlined white box is not the design.
        // 16px on a phone: anything smaller makes iOS Safari zoom the viewport
        // the moment the field takes focus, and it never zooms back out.
        formFieldInput:
            '!w-full !h-[48px] sm:!h-[52px] !rounded-[16px] !border !border-transparent focus:!border-[#7042f4] focus:!ring-4 focus:!ring-[#7042f4]/12 !bg-[#f4f4f6] !text-[#09090b] !text-[16px] sm:!text-[15px] !px-4 placeholder:!text-[#9ca3af] !outline-none transition-all',
        formFieldInputShowPasswordButton: '!text-[#9ca3af] hover:!text-[#52525b]',
        formFieldErrorText: '!text-[12.5px] !mt-1.5',

        formButtonPrimary:
            '!w-full !h-[48px] sm:!h-[52px] !rounded-full !bg-[#7042f4] hover:!bg-[#6330cf] active:!scale-[0.99] !text-white !font-semibold !text-[15px] !shadow-[0_6px_18px_rgba(112,66,244,0.28)] !normal-case !tracking-normal transition-all cursor-pointer !mt-2 flex items-center justify-center gap-2',

        formResendCodeLink: '!text-[#7042f4] hover:!text-[#6330cf] !font-semibold',
        identityPreviewEditButton: '!text-[#7042f4]',
        otpCodeFieldInput: '!h-[52px] !w-[46px] !rounded-[14px] !border-transparent !bg-[#f4f4f6] !text-[17px]',

        footer: '!bg-transparent !border-none !p-0 !mt-6',
        footerAction: '!bg-transparent !border-none !text-center',
        footerActionText: '!text-[#71717a] !text-[14px]',
        footerActionLink: '!text-[#7042f4] hover:!text-[#6330cf] !font-semibold !text-[14px]',
        footerPagesLink: '!text-[#a1a1aa] !text-xs hover:!text-[#09090b]',
    },
}
