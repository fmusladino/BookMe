'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Check, ChevronLeft, ChevronRight, ArrowLeft, User, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast as sonnerToast } from 'sonner';
import Link from 'next/link';

interface Professional {
  id: string;
  public_slug: string;
  specialty: string;
  city: string;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
  services: Service[];
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  show_price: boolean;
}

interface AvailableSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

type BookingStep = 'service' | 'date' | 'time' | 'confirm';

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [slug, setSlug] = useState<string>('');

  // State
  const [step, setStep] = useState<BookingStep>('service');
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Booking data
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Initialize slug and fetch data
  useEffect(() => {
    const initializeSlug = async () => {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);
    };
    initializeSlug();
  }, [params]);

  // Fetch professional data
  useEffect(() => {
    const fetchProfessional = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/professionals/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Profesional no encontrado');
          } else {
            setError('Error al cargar los datos del profesional');
          }
          return;
        }

        const data = await response.json();
        setProfessional(data.professional);
      } catch (err) {
        setError('Error de conexión');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessional();
  }, [slug]);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setIsLoggedIn(!!data.user);
    };

    checkAuth();
  }, []);

  // Fetch available slots when date and service change
  useEffect(() => {
    if (!selectedDate || !selectedService || !professional) return;

    const fetchSlots = async () => {
      try {
        setSlotsLoading(true);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const response = await fetch(
          `/api/schedule/available-slots?professionalId=${professional.id}&date=${dateStr}&serviceId=${selectedService.id}`
        );

        if (!response.ok) {
          setAvailableSlots([]);
          return;
        }

        const data = await response.json();
        setAvailableSlots(data.slots || []);
        setSelectedTime(null); // Reset selected time when slots change
      } catch (err) {
        console.error('Error fetching slots:', err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate, selectedService, professional]);

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !professional) return;

    if (!isLoggedIn) {
      // Redirect to login with return parameters
      const redirectUrl = `/book/${slug}?serviceId=${selectedService.id}&date=${format(selectedDate, 'yyyy-MM-dd')}&time=${selectedTime}`;
      router.push(`/login?redirectTo=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    try {
      setConfirming(true);

      // Parse the time — preservar hora local con offset Argentina (-03:00)
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const dateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      // Calcular hora de fin sumando duración del servicio
      const totalEndMinutes = hours * 60 + minutes + selectedService.duration_minutes;
      const endHours = Math.floor(totalEndMinutes / 60);
      const endMinutes = totalEndMinutes % 60;
      const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      // Enviar con offset explícito para evitar conversión UTC
      const startsAtISO = `${dateStr}T${startTimeStr}:00-03:00`;
      const endsAtISO = `${dateStr}T${endTimeStr}:00-03:00`;

      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_id: professional.id,
          service_id: selectedService.id,
          starts_at: startsAtISO,
          ends_at: endsAtISO,
          notes: '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        sonnerToast.error(error.error || 'Error al reservar');
        return;
      }

      sonnerToast.success('Reserva confirmada');
      setTimeout(() => {
        router.push('/mis-turnos');
      }, 1500);
    } catch (err) {
      console.error('Error confirming booking:', err);
      sonnerToast.error('Error de conexión');
    } finally {
      setConfirming(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {(['service', 'date', 'time', 'confirm'] as BookingStep[]).map((s, idx) => (
        <div key={s} className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
              step === s
                ? 'bg-bookme-navy text-white dark:bg-bookme-mint dark:text-bookme-navy'
                : s === 'service' || step === 'date' && s === 'date' || step === 'time' && (s === 'date' || s === 'time') || step === 'confirm' && (s !== 'confirm')
                ? 'bg-green-500 text-white dark:bg-green-600'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {(s === 'service' || (step !== 'service' && s === 'service')) && step !== 'service' ? (
              <Check size={20} />
            ) : (
              idx + 1
            )}
          </div>
          {idx < 3 && (
            <div
              className={`flex-1 h-1 mx-2 transition-colors ${
                step === s || (step !== s && step !== 'service')
                  ? 'bg-bookme-navy dark:bg-bookme-mint'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderServiceStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Seleccioná un servicio</h2>
      {professional?.services && professional.services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professional.services.map((service) => (
            <button
              key={service.id}
              onClick={() => {
                setSelectedService(service);
                setStep('date');
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedService?.id === service.id
                  ? 'border-bookme-navy bg-blue-50 dark:border-bookme-mint dark:bg-blue-900'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-semibold text-lg">{service.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {service.duration_minutes} min
              </div>
              {service.show_price && service.price !== null && (
                <div className="text-sm font-semibold mt-2 text-bookme-navy dark:text-bookme-mint">
                  ${service.price.toFixed(2)}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay servicios disponibles
        </div>
      )}
    </div>
  );

  const renderDateStep = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = getDay(monthStart);
    const emptyDays = Array(firstDayOfWeek).fill(null);

    const today = startOfDay(new Date());

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold mb-6">Seleccioná una fecha</h2>

        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="font-semibold text-lg">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((day) => (
            <div
              key={day}
              className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {emptyDays.map((_, idx) => (
            <div key={`empty-${idx}`} />
          ))}
          {daysInMonth.map((day) => {
            const isPast = isBefore(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);

            return (
              <button
                key={day.toISOString()}
                disabled={isPast}
                onClick={() => setSelectedDate(day)}
                className={`p-3 rounded-lg font-semibold transition-all ${
                  isPast
                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
                    : isSelected
                    ? 'bg-bookme-navy text-white dark:bg-bookme-mint dark:text-bookme-navy'
                    : isToday
                    ? 'bg-gray-100 border-2 border-bookme-navy dark:bg-gray-800 dark:border-bookme-mint'
                    : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
                }`}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Seleccioná un horario</h2>

      {slotsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-bookme-navy dark:text-bookme-mint" size={32} />
        </div>
      ) : availableSlots.length > 0 ? (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {availableSlots.map((slot) => {
            const timeLabel = format(new Date(slot.start), 'HH:mm');
            return (
              <button
                key={slot.start}
                onClick={() => setSelectedTime(timeLabel)}
                className={`p-3 rounded-lg font-semibold transition-all ${
                  selectedTime === timeLabel
                    ? 'bg-bookme-navy text-white dark:bg-bookme-mint dark:text-bookme-navy'
                    : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {timeLabel}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay horarios disponibles
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Confirmá tu reserva</h2>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        {/* Professional info */}
        <div className="flex items-start gap-4 pb-4 border-b border-border">
          {professional?.profile.avatar_url ? (
            <img
              src={professional.profile.avatar_url}
              alt={professional.profile.full_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <User size={24} className="text-gray-500 dark:text-gray-400" />
            </div>
          )}
          <div>
            <div className="font-semibold text-lg">{professional?.profile.full_name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {professional?.specialty} • {professional?.city}
            </div>
          </div>
        </div>

        {/* Service */}
        {selectedService && (
          <div className="flex items-center gap-2 py-2">
            <Check size={20} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-semibold">{selectedService.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedService.duration_minutes} minutos
              </div>
            </div>
          </div>
        )}

        {/* Date */}
        {selectedDate && (
          <div className="flex items-center gap-2 py-2">
            <Calendar size={20} className="text-bookme-navy dark:text-bookme-mint flex-shrink-0" />
            <div className="font-semibold">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
            </div>
          </div>
        )}

        {/* Time */}
        {selectedTime && (
          <div className="flex items-center gap-2 py-2">
            <Clock size={20} className="text-bookme-navy dark:text-bookme-mint flex-shrink-0" />
            <div className="font-semibold">{selectedTime}</div>
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <Button
          onClick={handleConfirmBooking}
          disabled={confirming}
          className="w-full bg-bookme-navy dark:bg-bookme-mint"
          size="lg"
        >
          {confirming ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Confirmando...
            </>
          ) : (
            'Confirmar reserva'
          )}
        </Button>
      ) : (
        <Button
          onClick={handleConfirmBooking}
          className="w-full bg-bookme-navy dark:bg-bookme-mint"
          size="lg"
        >
          Iniciá sesión para reservar
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-bookme-navy dark:text-bookme-mint" size={48} />
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{error || 'Profesional no encontrado'}</h1>
          <Link href="/">
            <Button variant="outline">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Reservá tu turno</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {professional.profile.full_name}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        {renderStepIndicator()}

        {/* Step content */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          {step === 'service' && renderServiceStep()}
          {step === 'date' && renderDateStep()}
          {step === 'time' && renderTimeStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>

        {/* Navigation buttons */}
        {step !== 'confirm' && (
          <div className="flex gap-4 justify-between">
            <Button
              onClick={() => {
                const steps: BookingStep[] = ['service', 'date', 'time', 'confirm'];
                const currentIdx = steps.indexOf(step);
                if (currentIdx > 0) {
                  setStep(steps[currentIdx - 1]);
                }
              }}
              variant="outline"
              disabled={step === 'service'}
            >
              Atrás
            </Button>

            <Button
              onClick={() => {
                if (step === 'service' && !selectedService) return;
                if (step === 'date' && !selectedDate) return;
                if (step === 'time' && !selectedTime) return;

                const steps: BookingStep[] = ['service', 'date', 'time', 'confirm'];
                const currentIdx = steps.indexOf(step);
                if (currentIdx < steps.length - 1) {
                  setStep(steps[currentIdx + 1]);
                }
              }}
              disabled={
                (step === 'service' && !selectedService) ||
                (step === 'date' && !selectedDate) ||
                (step === 'time' && !selectedTime)
              }
              className="bg-bookme-navy dark:bg-bookme-mint"
            >
              {step === 'time' ? 'Ir a confirmación' : 'Siguiente'}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
