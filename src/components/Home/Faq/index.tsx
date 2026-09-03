// components/Faq.js
'use client';
import Image from 'next/image';
import React, { useState } from 'react';// Optional: install lucide-react icons

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
    const [openIndex, setOpenIndex] = useState(null);

    const toggleFAQ = (index: any) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id='faq' className=" py-16 text-white">
            <div className="container">
                <div className=" mx-auto px-4">
                    <div className="text-center mb-10">
                        <p className="text-primary uppercase text-sm">Popular questions</p>
                        <h2 className="text-3xl md:text-4xl font-semibold mt-2">Learn more about Swippable</h2>
                        <p className="text-gray-400 mt-2">Secure payments and virtual cards for Africa</p>
                    </div>
                    <div className="space-y-4">
                        {faqData.map((item, index) => (
                            <div
                                key={index}
                                className="bg-white/5 rounded-lg p-4 cursor-pointer transition-all duration-300"
                                onClick={() => toggleFAQ(index)}
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium">{item.question}</h3>
                                    <Image
                                        src={"/images/icons/plus-icon.svg"}
                                        alt='plus-icon'
                                        width={20}
                                        height={20}
                                        className={`transform transition-transform duration-300 ${openIndex === index ? 'rotate-45' : ''}`}
                                    />
                                </div>

                                <div
                                    className={`mt-2 text-gray-400 overflow-hidden transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-40 visible' : 'max-h-0 hidden'
                                        }`}
                                >
                                    <p className="py-2">{item.answer}</p>
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
