// components/Faq.js
'use client';
import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const faqData = [
    {
        question: "What is Swippable?",
        answer: "Swippable is a secure payment platform that provides virtual cards and payment solutions designed for Africa.",
    },
    {
        question: "Is Swippable available in my country?",
        answer: "Swippable is available in Kenya and expanding across Africa. Check our coverage map for the latest updates.",
    },
    {
        question: "How do virtual cards work?",
        answer: "Virtual cards are digital payment cards that can be used online for secure transactions without exposing your real card details.",
    },
    {
        question: "Is my payment information secure with Swippable?",
        answer: "Yes, we use bank-level encryption and security protocols to protect your payment information and transactions.",
    },
    {
        question: "Are there any transaction fees?",
        answer: "Our fee structure is transparent and competitive. Visit our pricing page for detailed information on all fees.",
    },
    {
        question: "Can I use Swippable on mobile devices?",
        answer: "Yes, Swippable is fully optimized for mobile devices with dedicated apps for iOS and Android.",
    },
];

const Faq = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id='faq' className=" py-16 text-white">
            <div className="container">
                <div className=" mx-auto px-4">
                    <div className="text-center mb-10">
                        <p className="text-primary uppercase text-sm">Popular questions</p>
                        <h2 className="text-3xl md:text-4xl font-semibold mt-2">Learn more about Swippable</h2>
                        <p className="mt-2 text-white/60">Secure payments and virtual cards for Africa</p>
                    </div>
                    <div className="space-y-4">
                        {faqData.map((item, index) => (
                            <div
                                key={index}
                                className="cursor-pointer rounded-xl border border-white/5 bg-white/5 p-4 transition-colors duration-300 hover:border-primary/25 hover:bg-white/[0.07]"
                                onClick={() => toggleFAQ(index)}
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium">{item.question}</h3>
                                    <Plus
                                        size={20}
                                        className={`shrink-0 text-primary transition-transform duration-300 ${
                                            openIndex === index ? 'rotate-45' : ''
                                        }`}
                                    />
                                </div>

                                <div
                                    className={`grid overflow-hidden text-white/60 transition-all duration-300 ease-out ${
                                        openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                >
                                    <p className="min-h-0 pt-2">{item.answer}</p>
                                </div>
                            </div>
                        ))}

                    </div>
                </div>
            </div>
        </section>
    );
};

export default Faq;
