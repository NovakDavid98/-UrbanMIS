import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, SparklesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

function AIDisabledModal({ isOpen, onClose }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="absolute right-4 top-4">
                  <button
                    type="button"
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Icon */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                      <SparklesIcon className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                      <ExclamationTriangleIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>

                  {/* Title */}
                  <Dialog.Title
                    as="h3"
                    className="text-xl font-bold text-gray-900"
                  >
                    Chytré vyhledávání deaktivováno
                  </Dialog.Title>

                  {/* Description */}
                  <div className="space-y-3 text-sm text-gray-600">
                    <p className="leading-relaxed">
                      Funkce <span className="font-semibold text-purple-600">chytrého vyhledávání</span> je v demo verzi aplikace <span className="font-semibold">Centrální Mozek</span> dočasně vypnuta.
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                      <p className="font-medium text-blue-900 mb-1">
                        💡 Stále můžete použít:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-blue-800">
                        <li>Pokročilé filtry pro přesné vyhledávání</li>
                        <li>Textové vyhledávání podle jména a dalších polí</li>
                        <li>Všechny ostatní funkce aplikace</li>
                      </ul>
                    </div>

                    <p className="text-xs text-gray-500 italic">
                      Chytré vyhledávání je dostupné pouze v produkční verzi aplikace.
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    className="w-full inline-flex justify-center items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl"
                    onClick={onClose}
                  >
                    Rozumím
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default AIDisabledModal;

