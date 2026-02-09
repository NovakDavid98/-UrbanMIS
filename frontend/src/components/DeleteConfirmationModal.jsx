import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * DeleteConfirmationModal - A modal that requires typing "smazat" to confirm deletion.
 * Used for mass client deletion to prevent accidental deletions.
 */
function DeleteConfirmationModal({ isOpen, onClose, onConfirm, count, isDeleting = false }) {
    const [confirmText, setConfirmText] = useState('');
    const isConfirmEnabled = confirmText.toLowerCase() === 'smazat';

    // Reset input when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setConfirmText('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (isConfirmEnabled && !isDeleting) {
            onConfirm();
        }
    };

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
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
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
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                                            Smazat {count} klient{count === 1 ? 'a' : count < 5 ? 'y' : 'ů'}?
                                        </Dialog.Title>
                                        <p className="text-sm text-gray-500">
                                            Tato akce je nevratná.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Pro potvrzení napište <span className="font-bold text-red-600">smazat</span>:
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="smazat"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                        autoFocus
                                    />
                                </div>

                                <div className="mt-6 flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isDeleting}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        Zrušit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirm}
                                        disabled={!isConfirmEnabled || isDeleting}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isDeleting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Mazání...
                                            </>
                                        ) : (
                                            'Smazat'
                                        )}
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

export default DeleteConfirmationModal;
