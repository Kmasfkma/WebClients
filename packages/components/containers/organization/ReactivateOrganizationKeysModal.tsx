import { ChangeEvent, useState } from 'react';
import { c } from 'ttag';
import { encryptPrivateKey } from 'pmcrypto';

import { activateOrganizationKey, getOrganizationBackupKeys } from '@proton/shared/lib/api/organization';
import { OrganizationModel } from '@proton/shared/lib/models';
import { decryptPrivateKeyWithSalt } from '@proton/shared/lib/keys';
import { noop } from '@proton/shared/lib/helpers/function';
import {
    Alert,
    Button,
    Field,
    Form,
    Href,
    Label,
    ModalProps,
    ModalTwo as Modal,
    ModalTwoHeader as ModalHeader,
    ModalTwoContent as ModalContent,
    ModalTwoFooter as ModalFooter,
    PasswordInput,
    Row,
} from '../../components';
import { useCache, useLoading, useNotifications, useAuthentication, useEventManager, useApi } from '../../hooks';

interface Props extends ModalProps {
    mode: 'reactivate' | 'activate';
    onResetKeys?: () => void;
}

const ReactivateOrganizationKeysModal = ({ onResetKeys, mode, onClose, ...rest }: Props) => {
    const cache = useCache();
    const { createNotification } = useNotifications();
    const { call } = useEventManager();
    const authentication = useAuthentication();
    const api = useApi();

    const [loading, withLoading] = useLoading();
    const [backupPassword, setBackupPassword] = useState('');
    const [error, setError] = useState('');

    const { title, message, warning, success } = (() => {
        if (mode === 'activate') {
            return {
                title: c('Title').t`Activate organization key`,
                message: c('Info')
                    .t`You must activate your organization private key with the backup organization key password provided to you by your organization administrator.`,
                warning: c('Info')
                    .t`Without activation you will not be able to create new users, add addresses to existing users, or access non-private user accounts.`,
                success: c('Info').t`Organization keys activated`,
            };
        }

        if (mode === 'reactivate') {
            const learnMore = (
                <Href key={1} url="https://protonmail.com/support/knowledge-base/restore-administrator/">
                    {c('Link').t`Learn more`}
                </Href>
            );
            return {
                title: c('Title').t`Restore administrator privileges`,
                message: c('Info')
                    .jt`Enter the Organization Password to restore administrator privileges. ${learnMore}`,
                warning: c('Info')
                    .t`If another administrator changed this password, you will need to ask them for the new Organization Password.`,
                success: c('Info').t`Organization keys restored`,
            };
        }

        throw new Error('Invalid mode');
    })();

    const handleSubmit = async () => {
        try {
            setError('');

            const { PrivateKey, KeySalt } = await api(getOrganizationBackupKeys());
            const decryptedPrivateKey = await decryptPrivateKeyWithSalt({
                PrivateKey,
                password: backupPassword,
                keySalt: KeySalt,
            });
            const armoredPrivateKey = await encryptPrivateKey(decryptedPrivateKey, authentication.getPassword());
            await api(activateOrganizationKey(armoredPrivateKey));
            await call();
            // Warning: The organization model is deleted because there is no event manager notification for when the
            // organization key gets reactivated. Thus the organization is deleted from the cache which would trigger
            // the organizationKeys hook to re-run.
            cache.delete(OrganizationModel.key);

            createNotification({ text: success });
            onClose?.();
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleClose = loading ? noop : onClose;

    return (
        <Modal
            as={Form}
            onSubmit={() => {
                void withLoading(handleSubmit());
            }}
            onClose={handleClose}
            {...rest}
        >
            <ModalHeader title={title} />
            <ModalContent>
                <div className="mb1">{message}</div>
                <Row>
                    <Label htmlFor="organizationPassword">{c('Label').t`Organization password`}</Label>
                    <Field>
                        <PasswordInput
                            id="organizationPassword"
                            value={backupPassword}
                            onChange={({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
                                setBackupPassword(value)
                            }
                            error={error}
                            placeholder={c('Placeholder').t`Password`}
                            autoComplete="off"
                            autoFocus
                            required
                        />
                    </Field>
                </Row>
                <Alert className="mb1" type="warning">
                    {warning}
                </Alert>
            </ModalContent>
            <ModalFooter>
                <Button onClick={handleClose} disabled={loading}>
                    {c('Action').t`Close`}
                </Button>
                <div>
                    {onResetKeys && (
                        <Button
                            className="mr1"
                            onClick={() => {
                                onClose?.();
                                onResetKeys();
                            }}
                        >{c('Action').t`Reset keys`}</Button>
                    )}
                    <Button loading={loading} type="submit" color="norm">
                        {c('Action').t`Save`}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
};

export default ReactivateOrganizationKeysModal;
