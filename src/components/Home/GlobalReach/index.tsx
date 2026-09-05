"use client";
import { GlobalReachData } from "./data";
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer';

const GlobalReach = () => {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.5,
    });
    return (
        <section>
            <div className="container">
                <div ref={ref} className='grid grid-cols-1 gap-6 pt-20 sm:grid-cols-2 lg:grid-cols-4 xl:gap-10'>
                    {GlobalReachData.map((item, index) => {
                        return (
                            <div
                                key={index}
                                style={{ transitionDelay: `${index * 70}ms` }}
                                className={`flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition-all duration-500 ease-out hover:border-primary/30 hover:bg-white/[0.07] md:px-6 md:py-8 ${
                                    inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                                }`}>
                                <h3 className="text-3xl font-black text-primary">
                                    {item.prefix && item.prefix}
                                    {item.count == 247 ? "24/7" : inView ? <CountUp start={0} end={item.count} duration={3} /> : "0"}
                                    {item.postfix && item.postfix}
                                </h3>
                                <p className='text-white/80'>{item.title}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default GlobalReach