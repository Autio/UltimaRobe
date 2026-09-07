import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {RealisticPreview} from '@/components/studio/realistic-preview';

afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});

it('explains an unavailable renderer and prevents submitting a job',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({available:false})}));
 render(<RealisticPreview items={[]} skin="light" hair="brown" userId="synthetic-test"/>);
 expect(await screen.findByRole('button',{name:'Renderer not connected'})).toBeDisabled();
 expect(screen.getByRole('status')).toHaveTextContent('Your pixel wardrobe is ready to use');
});

it('offers rendering when the service reports ready',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({available:true})}));
 render(<RealisticPreview items={[]} skin="light" hair="brown" userId="synthetic-test"/>);
 expect(await screen.findByRole('button',{name:'Generate realistic estimate'})).toBeDisabled();
 expect(screen.queryByText(/Realistic rendering is not connected/)).not.toBeInTheDocument();
});

it('handles connection failures without leaving a working-looking submit button',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 render(<RealisticPreview items={[]} skin="light" hair="brown" userId="synthetic-test"/>);
 expect(await screen.findByRole('button',{name:'Renderer not connected'})).toBeDisabled();
});
